import { PushRuleKind } from 'matrix-js-sdk';
import { PushRuleActionName } from 'matrix-js-sdk/lib/@types/PushRules';
import type { MatrixClient, IPushRule } from 'matrix-js-sdk';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';

export type NotifLevel = 'all' | 'mentions' | 'mute';

export async function getNotifLevel(client: MatrixClient, roomId: string): Promise<NotifLevel> {
  const pushRules = client.pushRules;
  if (!pushRules) return 'all';

  // Check mute override
  const overrideRules: IPushRule[] = pushRules.global?.override ?? [];
  const overrideMuted = overrideRules.find((r) => r.rule_id === roomId);
  if (overrideMuted) {
    const actions = overrideMuted.actions ?? [];
    if (
      actions.includes(PushRuleActionName.DontNotify) ||
      actions.includes(PushRuleActionName.Coalesce)
    )
      return 'mute';
  }

  // Check room rule
  const roomRules: IPushRule[] = pushRules.global?.room ?? [];
  const roomRule = roomRules.find((r) => r.rule_id === roomId);
  if (roomRule) {
    const actions = roomRule.actions ?? [];
    if (actions.includes(PushRuleActionName.DontNotify)) return 'mentions';
  }

  return 'all';
}

export async function setNotifLevel(
  client: MatrixClient,
  roomId: string,
  level: NotifLevel
): Promise<void> {
  try {
    if (level === 'mute') {
      await client.setRoomMutePushRule('global', roomId, true);
    } else if (level === 'mentions') {
      await client.setRoomMutePushRule('global', roomId, false);
      try {
        await client.addPushRule('global', PushRuleKind.RoomSpecific, roomId, {
          actions: [PushRuleActionName.DontNotify],
        });
      } catch {
        /* may already exist */
      }
    } else {
      // all
      await client.setRoomMutePushRule('global', roomId, false);
      try {
        await client.deletePushRule('global', PushRuleKind.RoomSpecific, roomId);
      } catch {
        /* may not exist */
      }
    }
  } catch (err) {
    console.error('[useNotifications] setNotifLevel failed', err);
  }
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
  swRegistrationPromise = navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => navigator.serviceWorker.ready.then(() => reg))
    .catch((err) => {
      console.warn('[useNotifications] service worker registration failed', err);
      return null;
    });
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
