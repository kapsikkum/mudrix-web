import { useCallback } from 'react';
import {
  GearIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
} from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import { IconButton } from '@/app/components/Button';
import {
  settingsOpenAtom,
  userIdAtom,
  recoveryKeyBadgeAtom,
  showPresenceAtom,
  ownPresenceAtom,
  presenceOverrideAtom,
  userProfileAtom,
} from '@/app/store/atoms';
import type { PresenceState, PresenceOverride } from '@/app/store/atoms';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useSyncReady } from '@/app/hooks/useSync';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import { useGlobalVoiceState } from '@/app/features/voice/useGlobalVoice';
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
  const showPresence = useAtomValue(showPresenceAtom);
  const ownPresence = useAtomValue(ownPresenceAtom);
  const [presenceOverride, setPresenceOverride] = useAtom(presenceOverrideAtom);
  const setProfile = useSetAtom(userProfileAtom);
  const { openContextMenu } = useContextMenu();
  const { micMuted, deafened, toggleMic, toggleDeafen } = useGlobalVoiceState();

  const user = client && userId ? client.getUser(userId) : null;
  const displayName = user?.displayName ?? '';
  const avatarMxc = user?.avatarUrl ?? null;

  const openOwnProfile = useCallback(
    (e: React.MouseEvent) => {
      if (!userId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setProfile({
        userId,
        roomId: null,
        anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    },
    [userId, setProfile]
  );

  const MicIcon = micMuted ? MicrophoneSlashIcon : MicrophoneIcon;
  const micTitle = micMuted ? t('voice.unmute') : t('voice.mute');
  const deafenTitle = deafened ? t('voice.undeafen') : t('voice.deafen');

  const syncReady = useSyncReady();
  const hasPresence = showPresence && syncReady;
  const presence: PresenceState | undefined = hasPresence ? ownPresence : undefined;

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
        onAvatarClick={userId ? openOwnProfile : undefined}
      />
      <span className={css.userPanelId}>{displayName}</span>
      <div className={css.voiceControls}>
        <IconButton
          size="sm"
          danger={micMuted}
          tooltip={micTitle}
          aria-label={micTitle}
          onClick={toggleMic}
        >
          <MicIcon size={16} />
        </IconButton>
        <IconButton
          size="sm"
          danger={deafened}
          tooltip={deafenTitle}
          aria-label={deafenTitle}
          onClick={toggleDeafen}
        >
          <span className={css.deafenStrike}>
            <HeadphonesIcon size={16} />
            {deafened && (
              <span className={css.deafenStrikeSlash}>
                <span className={css.deafenStrikeOutline} />
                <span className={css.deafenStrikeCore} />
              </span>
            )}
          </span>
        </IconButton>
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
    </div>
  );
}
