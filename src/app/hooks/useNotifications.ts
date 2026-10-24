import { PushRuleKind, ConditionKind, TweakName } from 'matrix-js-sdk';
import {
  PushRuleActionName,
  type PushRuleAction,
  type IEventMatchCondition,
} from 'matrix-js-sdk/lib/@types/PushRules';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  playNotificationSoundFor,
  type NotificationSoundSettings,
} from '@/util/notificationSounds';
import { getThemeLogoAssets } from '@/theme/themeLogos';
import { isDesktopMuted, isTauri, showDesktopNotification } from '@/util/desktop';
import { publicUrl } from '@/util/publicUrl';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';

export type NotifLevel = 'default' | 'all' | 'mentions' | 'mute';

const mentionOverrideRuleIds = (roomId: string) => [
  `${roomId}.mentions.displayname`,
  `${roomId}.mentions.user_ids`,
  `${roomId}.mentions.at_room`,
];

function isMutedActions(actions: PushRuleAction[] | undefined): boolean {
  return !actions?.length || actions.includes(PushRuleActionName.DontNotify);
}

export function getNotifLevelSync(client: MatrixClient, roomId: string): NotifLevel {
  const rules = client.pushRules;
  if (!rules) return 'default';

  const overrideMute = (rules.global?.override ?? []).find(
    (r) => r.rule_id === roomId && isMutedActions(r.actions)
  );
  if (overrideMute?.enabled) return 'mute';

  const roomRule = (rules.global?.room ?? []).find((r) => r.rule_id === roomId);
  if (roomRule?.enabled) {
    return isMutedActions(roomRule.actions) ? 'mentions' : 'all';
  }
  return 'default';
}

async function deletePushRuleIfExists(
  client: MatrixClient,
  kind: PushRuleKind,
  ruleId: string
): Promise<void> {
  try {
    await client.deletePushRule('global', kind, ruleId);
  } catch {
    /* may not exist */
  }
}

export async function setNotifLevel(
  client: MatrixClient,
  roomId: string,
  level: NotifLevel
): Promise<void> {
  // Clear any existing rules first so level switches work cleanly.
  await deletePushRuleIfExists(client, PushRuleKind.RoomSpecific, roomId);
  await deletePushRuleIfExists(client, PushRuleKind.Override, roomId);
  for (const ruleId of mentionOverrideRuleIds(roomId)) {
    await deletePushRuleIfExists(client, PushRuleKind.Override, ruleId);
  }

  if (level === 'mute') {
    await client.addPushRule('global', PushRuleKind.Override, roomId, {
      conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
      actions: [],
    });
  } else if (level === 'all') {
    await client.addPushRule('global', PushRuleKind.RoomSpecific, roomId, {
      actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Sound, value: 'default' }],
    });
  } else if (level === 'mentions') {
    await client.addPushRule('global', PushRuleKind.RoomSpecific, roomId, {
      actions: [],
    });

    const roomMatch: IEventMatchCondition = {
      kind: ConditionKind.EventMatch,
      key: 'room_id',
      pattern: roomId,
    };
    const notifyActions: PushRuleAction[] = [
      PushRuleActionName.Notify,
      { set_tweak: TweakName.Highlight, value: true },
    ];

    await client.addPushRule('global', PushRuleKind.Override, `${roomId}.mentions.displayname`, {
      conditions: [roomMatch, { kind: ConditionKind.ContainsDisplayName }],
      actions: notifyActions,
    });

    const myId = client.getUserId();
    if (myId) {
      await client.addPushRule('global', PushRuleKind.Override, `${roomId}.mentions.user_ids`, {
        conditions: [
          roomMatch,
          {
            kind: ConditionKind.EventPropertyContains,
            key: 'content.m\\.mentions.user_ids',
            value: myId,
          },
        ],
        actions: notifyActions,
      });
    }

    await client.addPushRule('global', PushRuleKind.Override, `${roomId}.mentions.at_room`, {
      conditions: [
        roomMatch,
        { kind: ConditionKind.EventPropertyIs, key: 'content.m\\.mentions.room', value: true },
      ],
      actions: notifyActions,
    });
  }

  // Refresh local cache so getPushActionsForEvent sees the new rules immediately.
  client.pushRules = await client.getPushRules();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // The desktop shell shows OS notifications itself; there is no permission prompt.
  if (isTauri()) return 'granted';
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function playNotificationSound(
  soundEnabled: boolean,
  settings: NotificationSoundSettings,
  priority = false
): void {
  if (!soundEnabled || isDesktopMuted()) return;
  playNotificationSoundFor(settings, priority);
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistrationPromise) return swRegistrationPromise;
  // Not inside the desktop shell: its webview origin cannot host /sw.js, and the shell
  // delivers notifications natively.
  if (isTauri() || !('serviceWorker' in navigator)) {
    swRegistrationPromise = Promise.resolve(null);
    return swRegistrationPromise;
  }
  swRegistrationPromise = (async () => {
    try {
      const reg = await navigator.serviceWorker.register(publicUrl('sw.js'));
      await navigator.serviceWorker.ready;

      await reg.update();

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      return reg;
    } catch (err) {
      console.warn('[useNotifications] service worker registration failed', err);
      return null;
    }
  })();
  return swRegistrationPromise;
}

const NOTIFICATION_AVATAR_PX = 96;

/**
 * A sender's avatar as a small PNG data URL for a notification icon, or null. Avatars are
 * authenticated media, which neither the OS nor a service worker can fetch on their own, and a
 * Windows toast only takes PNG, JPEG or GIF; so it is fetched here and redrawn as PNG.
 */
export async function getNotificationAvatar(
  client: MatrixClient,
  mxc: string | null | undefined
): Promise<string | null> {
  if (!mxc) return null;
  try {
    const px = NOTIFICATION_AVATAR_PX;
    const src = await fetchMediaBlobUrl(mxc, client, 0, px, px, 'crop');
    if (!src) return null;
    const img = new Image();
    img.src = src;
    await Promise.race([
      img.decode(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('timeout')), 3000);
      }),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Cover-crop to a square, the way avatars are shown.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      px,
      px
    );
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function showBrowserNotification(
  title: string,
  body: string,
  roomUrl?: string,
  icon = getThemeLogoAssets().notification,
  nativeSound?: string
): Promise<void> {
  if (isTauri()) {
    await showDesktopNotification(
      title,
      body,
      roomUrl,
      nativeSound,
      icon.startsWith('data:') ? icon : undefined
    );
    return;
  }

  if (window.electronAPI?.showNotification) {
    try {
      await window.electronAPI.showNotification({ title, body, icon, silent: true, roomUrl });
      return;
    } catch (err) {
      console.warn('[useNotifications] electron showNotification failed, falling back', err);
    }
  }

  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const data = roomUrl ? { url: publicUrl(roomUrl) } : undefined;

  const reg = await registerNotificationServiceWorker();
  if (reg) {
    try {
      await reg.showNotification(title, { body, icon, silent: true, data });
      return;
    } catch (err) {
      console.warn('[useNotifications] SW showNotification failed, falling back', err);
    }
  }

  try {
    const n = new Notification(title, { body, icon, silent: true, data });
    n.onclick = roomUrl
      ? () => {
          window.focus();
          window.location.href = publicUrl(roomUrl);
        }
      : null;
    n.onerror = () => {};
  } catch {
    // ignore
  }
}
