import { GearIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import { IconButton } from '@/app/components/Button';
import {
  settingsOpenAtom,
  userIdAtom,
  recoveryKeyBadgeAtom,
  preferencesAtom,
  syncStateAtom,
  ownIdleAtom,
} from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import * as css from './UserPanel.css';

export function UserPanel() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const userId = useAtomValue(userIdAtom);
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const badge = useAtomValue(recoveryKeyBadgeAtom);
  const prefs = useAtomValue(preferencesAtom);
  const syncState = useAtomValue(syncStateAtom);
  const ownIdle = useAtomValue(ownIdleAtom);

  const user = client && userId ? client.getUser(userId) : null;
  const displayName = user?.displayName ?? '';
  const avatarMxc = user?.avatarUrl ?? null;

  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';
  const ownPresence: PresenceState | undefined =
    prefs.showPresence && syncReady ? (ownIdle ? 'unavailable' : 'online') : undefined;

  return (
    <div className={css.userPanel}>
      <Avatar
        name={displayName}
        mxcUrl={avatarMxc}
        client={client ?? undefined}
        size="sm"
        presence={ownPresence}
      />
      <span className={css.userPanelId}>{displayName}</span>
      <div className={css.gearWrap}>
        <IconButton
          size="sm"
          tooltip={t('settings.userSettings')}
          aria-label={t('settings.userSettings')}
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon size={16} />
        </IconButton>
        {badge && <span className={css.gearBadge} />}
      </div>
    </div>
  );
}
