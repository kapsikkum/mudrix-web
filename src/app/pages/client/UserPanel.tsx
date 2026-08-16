import { useCallback } from 'react';
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
  ownPresenceAtom,
  presenceOverrideAtom,
} from '@/app/store/atoms';
import type { PresenceState, PresenceOverride } from '@/app/store/atoms';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import * as css from './UserPanel.css';

const PRESENCE_DOT_COLOR: Record<Exclude<PresenceOverride, 'auto'>, string> = {
  online: '#4ade80',
  unavailable: '#facc15',
  offline: '#6b7280',
};

export function UserPanel() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const userId = useAtomValue(userIdAtom);
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const badge = useAtomValue(recoveryKeyBadgeAtom);
  const prefs = useAtomValue(preferencesAtom);
  const syncState = useAtomValue(syncStateAtom);
  const ownPresence = useAtomValue(ownPresenceAtom);
  const [presenceOverride, setPresenceOverride] = useAtom(presenceOverrideAtom);
  const { openContextMenu } = useContextMenu();

  const user = client && userId ? client.getUser(userId) : null;
  const displayName = user?.displayName ?? '';
  const avatarMxc = user?.avatarUrl ?? null;

  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';
  const showPresence = prefs.showPresence && syncReady;
  const presence: PresenceState | undefined = showPresence ? ownPresence : undefined;

  const handlePresenceDotClick = useCallback(
    (e: React.MouseEvent) => {
      const dotIcon = (state: Exclude<PresenceOverride, 'auto'>) => (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: PRESENCE_DOT_COLOR[state],
          }}
        />
      );
      const items: ContextMenuItem[] = [
        {
          label: t('presence.auto'),
          icon: (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: '2px solid currentColor',
              }}
            />
          ),
          checked: presenceOverride === 'auto',
          onClick: () => setPresenceOverride('auto'),
        },
        {
          label: t('presence.online'),
          icon: dotIcon('online'),
          checked: presenceOverride === 'online',
          onClick: () => setPresenceOverride('online'),
        },
        {
          label: t('presence.away'),
          icon: dotIcon('unavailable'),
          checked: presenceOverride === 'unavailable',
          onClick: () => setPresenceOverride('unavailable'),
        },
        {
          label: t('presence.offline'),
          icon: dotIcon('offline'),
          checked: presenceOverride === 'offline',
          onClick: () => setPresenceOverride('offline'),
        },
      ];
      openContextMenu(e, items);
    },
    [t, presenceOverride, setPresenceOverride, openContextMenu]
  );

  return (
    <div className={css.userPanel}>
      <Avatar
        name={displayName}
        mxcUrl={avatarMxc}
        client={client ?? undefined}
        size="sm"
        presence={presence}
        presenceDotLabel={t('presence.changeStatus')}
        onPresenceDotClick={showPresence ? handlePresenceDotClick : undefined}
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
