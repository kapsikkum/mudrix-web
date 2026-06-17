import { GearIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import { IconButton } from '@/app/components/Button';
import { settingsOpenAtom, userIdAtom, recoveryKeyBadgeAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId } from '@/util/matrix';
import * as css from './UserPanel.css';

export function UserPanel() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const userId = useAtomValue(userIdAtom);
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const badge = useAtomValue(recoveryKeyBadgeAtom);

  const displayName = userId ? formatUserId(userId) : '';
  const user = client && userId ? client.getUser(userId) : null;
  const avatarMxc = user?.avatarUrl ?? null;

  return (
    <div className={css.userPanel}>
      <Avatar name={displayName} mxcUrl={avatarMxc} client={client ?? undefined} size="sm" />
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
