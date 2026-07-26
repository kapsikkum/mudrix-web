import { PushRuleKind, ConditionKind } from 'matrix-js-sdk';
import { PushRuleActionName } from 'matrix-js-sdk/lib/@types/PushRules';
import type { MatrixClient } from 'matrix-js-sdk';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';

export type NotifLevel = 'all' | 'mentions' | 'mute';

export async function getNotifLevel(client: MatrixClient, roomId: string): Promise<NotifLevel> {
  const rules = client.pushRules;
  if (!rules) return 'all';

  const overrideMute = (rules.global?.override ?? []).find(
    (r) => r.rule_id === roomId && (r.actions ?? []).includes(PushRuleActionName.DontNotify)
  );
  if (overrideMute?.enabled) return 'mute';

  const roomRule = (rules.global?.room ?? []).find((r) => r.rule_id === roomId);
  if (roomRule?.enabled && (roomRule.actions ?? []).includes(PushRuleActionName.DontNotify)) {
    return 'mentions';
  }
  return 'all';
}

export async function setNotifLevel(
  client: MatrixClient,
  roomId: string,
  level: NotifLevel
): Promise<void> {
  // Clear any existing rules first so level switches work cleanly.
  try {
    await client.deletePushRule('global', PushRuleKind.RoomSpecific, roomId);
  } catch {
    /* may not exist */
  }
  try {
    await client.deletePushRule('global', PushRuleKind.Override, roomId);
  } catch {
    /* may not exist */
  }

  if (level === 'mute') {
    await client.addPushRule('global', PushRuleKind.Override, roomId, {
      conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
      actions: [PushRuleActionName.DontNotify],
    });
  } else if (level === 'mentions') {
    await client.addPushRule('global', PushRuleKind.RoomSpecific, roomId, {
      actions: [PushRuleActionName.DontNotify],
    });
  }

  // Refresh local cache so getPushActionsForEvent sees the new rules immediately.
  client.pushRules = await client.getPushRules();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
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

export function playNotificationSound(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  playVoiceSound('alert');
}

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistrationPromise) return swRegistrationPromise;
  if (!('serviceWorker' in navigator)) {
    swRegistrationPromise = Promise.resolve(null);
    return swRegistrationPromise;
  }
  swRegistrationPromise = (async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
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

export async function showBrowserNotification(
  title: string,
  body: string,
  icon = '/assets/images/logo-notification.svg'
): Promise<void> {
  if (window.electronAPI?.showNotification) {
    try {
      await window.electronAPI.showNotification({ title, body, icon, silent: true });
      return;
    } catch (err) {
      console.warn('[useNotifications] electron showNotification failed, falling back', err);
    }
  }

  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const reg = await registerNotificationServiceWorker();
  if (reg) {
    try {
      await reg.showNotification(title, { body, icon, silent: true });
      return;
    } catch (err) {
      console.warn('[useNotifications] SW showNotification failed, falling back', err);
    }
  }

  try {
    const n = new Notification(title, { body, icon, silent: true });
    n.onerror = () => {};
  } catch {
    // ignore
  }
}
