import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon } from '@phosphor-icons/react';
import { EventType, JoinRule, type Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import * as css from './SpaceSettings.css';

function getStateEventContent(room: Room | null, type: string): Record<string, unknown> {
  return room?.currentState?.getStateEvents(type, '')?.getContent<Record<string, unknown>>() ?? {};
}

interface SecurityPrivacyPanelProps {
  spaceId: string;
}

type AccessOption = 'invite' | 'public';

export function SecurityPrivacyPanel({ spaceId }: SecurityPrivacyPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const space = client?.getRoom(spaceId) ?? null;
  const myUserId = client?.getUserId() ?? '';
  const isAdmin = (space?.getMember(myUserId)?.powerLevel ?? 0) >= 100;

  const joinRulesContent = getStateEventContent(space, 'm.room.join_rules');
  const currentJoinRule: string =
    (joinRulesContent?.join_rule as string | undefined) ?? JoinRule.Invite;

  function joinRuleToAccess(rule: string): AccessOption {
    return rule === JoinRule.Public ? 'public' : 'invite';
  }

  const [access, setAccess] = useState<AccessOption>(joinRuleToAccess(currentJoinRule));
  const [saving, setSaving] = useState(false);

  const isDirty = access !== joinRuleToAccess(currentJoinRule);

  const handleSave = async () => {
    if (!client || !space) return;
    setSaving(true);
    try {
      const newJoinRule = access === 'public' ? JoinRule.Public : JoinRule.Invite;
      if (newJoinRule !== currentJoinRule) {
        await client.sendStateEvent(
          spaceId,
          EventType.RoomJoinRules,
          { join_rule: newJoinRule },
          ''
        );
      }
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
          {t('room.settings.readOnlySpace')}
        </div>
      )}

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.security.access')}</h3>
        <p className={css.settingNote} style={{ marginBottom: '16px' }}>
          {t('room.settings.security.accessNoteSpace')}
        </p>

        <div>
          <div
            className={css.settingRow}
            style={{ cursor: !isAdmin ? 'not-allowed' : 'pointer', opacity: !isAdmin ? 0.5 : 1 }}
            onClick={() => isAdmin && setAccess('invite')}
          >
            <div className={css.settingInfo}>
              <span className={css.settingLabel}>
                {t('room.settings.security.accessInviteSpace')}
              </span>
              <span className={css.settingNote}>
                {t('room.settings.security.accessInviteSpaceNote')}
              </span>
            </div>
            <div className={`${css.radioCircle} ${access === 'invite' ? css.radioCircleSelected : ''}`}>
              {access === 'invite' && <div className={css.radioCircleDot} />}
            </div>
          </div>

          <div
            className={css.settingRow}
            style={{ cursor: !isAdmin ? 'not-allowed' : 'pointer', opacity: !isAdmin ? 0.5 : 1 }}
            onClick={() => isAdmin && setAccess('public')}
          >
            <div className={css.settingInfo}>
              <span className={css.settingLabel}>
                {t('room.settings.security.accessPublicSpace')}
              </span>
              <span className={css.settingNote}>
                {t('room.settings.security.accessPublicSpaceNote')}
              </span>
            </div>
            <div className={`${css.radioCircle} ${access === 'public' ? css.radioCircleSelected : ''}`}>
              {access === 'public' && <div className={css.radioCircleDot} />}
            </div>
          </div>
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
