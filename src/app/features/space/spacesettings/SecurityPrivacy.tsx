import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventType, JoinRule, RestrictedAllowType } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Button } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import { getStateEventContent, joinRuleToAccess } from '@/util/matrix';
import { Select } from '@/app/components/Select';
import * as css from '@/app/components/Settings/Settings.css';

interface SecurityPrivacyPanelProps {
  spaceId: string;
}

type AccessOption = 'invite' | 'restricted' | 'public' | 'knock';

export function SecurityPrivacyPanel({ spaceId }: SecurityPrivacyPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const space = client?.getRoom(spaceId) ?? null;
  const can = useCanSendState(space);
  const canSetJoinRules = can(EventType.RoomJoinRules);

  const joinRulesContent = getStateEventContent(space, 'm.room.join_rules');
  const currentJoinRule: string =
    (joinRulesContent?.join_rule as string | undefined) ?? JoinRule.Invite;

  const [access, setAccess] = useState<AccessOption>(
    joinRuleToAccess(currentJoinRule) as AccessOption
  );
  const [saving, setSaving] = useState(false);

  const isDirty = access !== joinRuleToAccess(currentJoinRule);

  const handleSave = async () => {
    if (!client || !space) return;
    setSaving(true);
    try {
      const newJoinRule =
        access === 'public'
          ? JoinRule.Public
          : access === 'restricted'
            ? JoinRule.Restricted
            : access === 'knock'
              ? JoinRule.Knock
              : JoinRule.Invite;
      if (newJoinRule !== currentJoinRule) {
        const joinRuleContent: {
          join_rule: JoinRule;
          allow?: { type: RestrictedAllowType; room_id: string }[];
        } = {
          join_rule: newJoinRule,
        };
        if (access === 'restricted') {
          joinRuleContent.allow = [{ type: RestrictedAllowType.RoomMembership, room_id: spaceId }];
        }
        await client.sendStateEvent(spaceId, EventType.RoomJoinRules, joinRuleContent, '');
      }
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
          <Select
            aria-label={t('room.settings.security.access')}
            value={access}
            disabled={!canSetJoinRules}
            options={[
              { value: 'invite', label: t('room.settings.security.accessInviteSpace') },
              { value: 'restricted', label: t('room.settings.security.accessSpaceMembers') },
              { value: 'knock', label: t('room.settings.security.accessKnock') },
              { value: 'public', label: t('room.settings.security.accessPublicSpace') },
            ]}
            onChange={(v) => setAccess(v as AccessOption)}
          />
        </div>
      </div>

      {canSetJoinRules && (
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
