import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventType, HistoryVisibility, JoinRule, RestrictedAllowType } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import { getStateEventContent, joinRuleToAccess, roomState } from '@/util/matrix';
import * as css from '@/app/components/Settings/Settings.css';

interface SecurityPrivacyPanelProps {
  roomId: string;
}

type AccessOption = 'invite' | 'restricted' | 'public' | 'knock';

export function SecurityPrivacyPanel({ roomId }: SecurityPrivacyPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const room = client?.getRoom(roomId) ?? null;
  const can = useCanSendState(room);
  const canSetJoinRules = can(EventType.RoomJoinRules);
  const canSetHistory = can(EventType.RoomHistoryVisibility);

  const joinRulesContent = getStateEventContent(room, 'm.room.join_rules');
  const historyContent = getStateEventContent(room, 'm.room.history_visibility');

  const currentJoinRule: string =
    (joinRulesContent?.join_rule as string | undefined) ?? JoinRule.Invite;
  const currentHistory: HistoryVisibility =
    (historyContent?.history_visibility as HistoryVisibility) ?? HistoryVisibility.Joined;

  const [access, setAccess] = useState<AccessOption>(
    joinRuleToAccess(currentJoinRule) as AccessOption
  );
  const [history, setHistory] = useState<HistoryVisibility>(currentHistory);
  const [saving, setSaving] = useState(false);

  const HISTORY_RANK: Record<HistoryVisibility, number> = {
    [HistoryVisibility.WorldReadable]: 3,
    [HistoryVisibility.Shared]: 2,
    [HistoryVisibility.Invited]: 1,
    [HistoryVisibility.Joined]: 0,
  };

  const historyOptions: { value: HistoryVisibility; label: string }[] = [
    { value: HistoryVisibility.WorldReadable, label: t('room.settings.security.historyAnyone') },
    { value: HistoryVisibility.Shared, label: t('room.settings.security.historyShared') },
    { value: HistoryVisibility.Invited, label: t('room.settings.security.historyInvited') },
    { value: HistoryVisibility.Joined, label: t('room.settings.security.historyMembersSinceJoin') },
  ];

  // Detect if the room is inside a space by checking m.space.child on each space
  const spaceId =
    client?.getRooms().find(
      (r) =>
        r.isSpaceRoom() &&
        roomState(r)
          .getStateEvents('m.space.child')
          .some((e) => e.getStateKey() === roomId)
    )?.roomId ?? null;

  const isDirty = access !== joinRuleToAccess(currentJoinRule) || history !== currentHistory;

  const handleSave = async () => {
    if (!client || !room) return;
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];

      const targetJoinRule =
        access === 'public'
          ? JoinRule.Public
          : access === 'restricted'
            ? JoinRule.Restricted
            : access === 'knock'
              ? JoinRule.Knock
              : JoinRule.Invite;
      if (targetJoinRule !== currentJoinRule) {
        const joinRuleContent: {
          join_rule: JoinRule;
          allow?: { type: RestrictedAllowType; room_id: string }[];
        } = {
          join_rule: targetJoinRule,
        };
        if (access === 'restricted' && spaceId) {
          joinRuleContent.allow = [{ type: RestrictedAllowType.RoomMembership, room_id: spaceId }];
        }
        ops.push(client.sendStateEvent(roomId, EventType.RoomJoinRules, joinRuleContent, ''));
      }

      if (history !== currentHistory) {
        ops.push(
          client.sendStateEvent(
            roomId,
            EventType.RoomHistoryVisibility,
            { history_visibility: history },
            ''
          )
        );
      }

      await Promise.all(ops);
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.security.title')}</h2>

      <div className={css.section}>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('room.settings.security.access')}</span>
          </div>
          <select
            className={css.select}
            value={access}
            onChange={(e) => setAccess(e.target.value as AccessOption)}
            disabled={!canSetJoinRules}
          >
            <option value="invite">{t('room.settings.security.accessInvite')}</option>
            {spaceId && (
              <option value="restricted">{t('room.settings.security.accessSpaceMembers')}</option>
            )}
            <option value="knock">{t('room.settings.security.accessKnock')}</option>
            <option value="public">{t('room.settings.security.accessPublic')}</option>
          </select>
        </div>
      </div>

      <div className={css.section}>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('room.settings.security.messageHistory')}</span>
          </div>
          <select
            className={css.select}
            value={history}
            onChange={(e) => setHistory(e.target.value as HistoryVisibility)}
            disabled={!canSetHistory}
          >
            {historyOptions.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={HISTORY_RANK[opt.value] > HISTORY_RANK[currentHistory]}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(canSetJoinRules || canSetHistory) && (
        <div className={css.actions}>
          <Button
            variant="primary"
            loading={saving}
            spinnerWhileLoading
            onClick={handleSave}
            disabled={!isDirty}
          >
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
