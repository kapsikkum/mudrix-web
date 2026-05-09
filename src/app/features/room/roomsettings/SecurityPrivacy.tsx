import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon } from '@phosphor-icons/react';
import { EventType, HistoryVisibility, JoinRule, type Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import * as css from './RoomSettings.css';

function getStateEventContent(room: Room | null, type: string): Record<string, unknown> {
  return room?.currentState?.getStateEvents(type, '')?.getContent<Record<string, unknown>>() ?? {};
}

interface SecurityPrivacyPanelProps {
  roomId: string;
}

type AccessOption = 'invite' | 'restricted' | 'public';

export function SecurityPrivacyPanel({ roomId }: SecurityPrivacyPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const room = client?.getRoom(roomId) ?? null;
  const myUserId = client?.getUserId() ?? '';
  const isAdmin = (room?.getMember(myUserId)?.powerLevel ?? 0) >= 100;

  const joinRulesContent = getStateEventContent(room, 'm.room.join_rules');
  const historyContent = getStateEventContent(room, 'm.room.history_visibility');

  const currentJoinRule: string =
    (joinRulesContent?.join_rule as string | undefined) ?? JoinRule.Invite;
  const currentHistory: HistoryVisibility =
    (historyContent?.history_visibility as HistoryVisibility) ?? HistoryVisibility.Joined;

  // Derive which access option is active
  function joinRuleToAccess(rule: string): AccessOption {
    if (rule === JoinRule.Public) return 'public';
    if (rule === 'restricted' || rule === 'knock_restricted') return 'restricted';
    return 'invite';
  }

  const [access, setAccess] = useState<AccessOption>(joinRuleToAccess(currentJoinRule));
  const [history, setHistory] = useState<HistoryVisibility>(currentHistory);
  const [saving, setSaving] = useState(false);

  // Detect if the room is inside a space (has m.space.parent)
  const spaceParentEvent = room?.currentState?.getStateEvents('m.space.parent') ?? [];
  const parentEvents = Array.isArray(spaceParentEvent) ? spaceParentEvent : [spaceParentEvent];
  const spaceId = parentEvents[0]?.getStateKey?.() ?? null;

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
            ? 'restricted'
            : JoinRule.Invite;
      if (targetJoinRule !== currentJoinRule) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const joinRuleContent: any = { join_rule: targetJoinRule };
        if (access === 'restricted' && spaceId) {
          joinRuleContent.allow = [{ type: 'm.room_membership', room_id: spaceId }];
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
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.security.title')}</h2>

      {!isAdmin && (
        <div className={css.readOnlyNote}>
          <EyeIcon size={14} />
          {t('room.settings.readOnlyRoom')}
        </div>
      )}

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.security.access')}</h3>
        <p className={css.settingNote} style={{ marginBottom: '16px' }}>
          {t('room.settings.security.accessNote')}
        </p>

        <div className={css.radioGroup}>
          <label className={css.radioItem}>
            <input
              type="radio"
              name="access"
              value="invite"
              checked={access === 'invite'}
              onChange={() => setAccess('invite')}
              disabled={!isAdmin}
            />
            <div className={css.radioContent}>
              <span className={css.radioLabel}>{t('room.settings.security.accessInvite')}</span>
              <span className={css.settingNote}>
                {t('room.settings.security.accessInviteNote')}
              </span>
            </div>
          </label>

          {spaceId && (
            <label className={css.radioItem}>
              <input
                type="radio"
                name="access"
                value="restricted"
                checked={access === 'restricted'}
                onChange={() => setAccess('restricted')}
                disabled={!isAdmin}
              />
              <div className={css.radioContent}>
                <span className={css.radioLabel}>
                  {t('room.settings.security.accessSpaceMembers')}
                </span>
                <span className={css.settingNote}>
                  {t('room.settings.security.accessSpaceMembersNote')}
                </span>
              </div>
            </label>
          )}

          <label className={css.radioItem}>
            <input
              type="radio"
              name="access"
              value="public"
              checked={access === 'public'}
              onChange={() => setAccess('public')}
              disabled={!isAdmin}
            />
            <div className={css.radioContent}>
              <span className={css.radioLabel}>{t('room.settings.security.accessPublic')}</span>
              <span className={css.settingNote}>
                {t('room.settings.security.accessPublicNote')}
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.security.messageHistory')}</h3>
        <p className={css.settingNote} style={{ marginBottom: '16px' }}>
          {t('room.settings.security.messageHistoryNote')}
        </p>

        <div className={css.radioGroup}>
          <label className={css.radioItem}>
            <input
              type="radio"
              name="history"
              value="shared"
              checked={history !== HistoryVisibility.Joined}
              onChange={() => setHistory(HistoryVisibility.Shared)}
              disabled={!isAdmin}
            />
            <div className={css.radioContent}>
              <span className={css.radioLabel}>
                {t('room.settings.security.historyFullHistory')}
              </span>
              <span className={css.settingNote}>
                {t('room.settings.security.historyFullHistoryNote')}
              </span>
            </div>
          </label>

          <label className={css.radioItem}>
            <input
              type="radio"
              name="history"
              value="joined"
              checked={history === HistoryVisibility.Joined}
              onChange={() => setHistory(HistoryVisibility.Joined)}
              disabled={!isAdmin}
            />
            <div className={css.radioContent}>
              <span className={css.radioLabel}>
                {t('room.settings.security.historyMembersSinceJoin')}
              </span>
              <span className={css.settingNote}>
                {t('room.settings.security.historyMembersSinceJoinNote')}
              </span>
            </div>
          </label>
        </div>
      </div>

      {isAdmin && (
        <div className={css.actions}>
          <Button variant="primary" loading={saving} onClick={handleSave} disabled={!isDirty}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
