import { PushRuleKind } from 'matrix-js-sdk';
import { PushRuleActionName } from 'matrix-js-sdk/lib/@types/PushRules';
import type { MatrixClient, IPushRule } from 'matrix-js-sdk';

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

export function showBrowserNotification(
  title: string,
  body: string,
  icon = '/assets/images/logo-notification.svg'
): void {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon });
}
