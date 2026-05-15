import { useTranslation } from 'react-i18next';
import type { MatrixEvent } from 'matrix-js-sdk';
import { SignInIcon, SignOutIcon, UserCircleIcon } from '@phosphor-icons/react';
import * as css from '../Timeline.css';

interface SystemMessageProps {
  event: MatrixEvent;
  senderName: string;
}

export function SystemMessageDisplay({ event, senderName }: SystemMessageProps) {
  const { t } = useTranslation();

  const content = event.getContent();
  const prevContent = event.getPrevContent();
  const membership = content?.membership as string | undefined;
  const prevMembership = prevContent?.membership as string | undefined;

  let icon: React.ReactNode;
  let label: React.ReactNode;

  if (membership === 'join' && prevMembership !== 'join') {
    icon = <SignInIcon size={14} />;
    label = t('timeline.userJoined', { name: senderName });
  } else if ((membership === 'leave' || membership === 'ban') && prevMembership === 'join') {
    icon = <SignOutIcon size={14} />;
    label =
      membership === 'ban'
        ? t('timeline.userBanned', { name: senderName })
        : t('timeline.userLeft', { name: senderName });
  } else if (membership === 'join' && prevMembership === 'join') {
    const newName = content?.displayname as string | undefined;
    const oldName = prevContent?.displayname as string | undefined;
    const newAvatar = content?.avatar_url as string | undefined;
    const oldAvatar = prevContent?.avatar_url as string | undefined;
    if (newName !== oldName && oldName) {
      icon = <UserCircleIcon size={14} />;
      label = t('timeline.userRenamedFromTo', { name: oldName, newName: newName ?? senderName });
    } else if (newAvatar !== oldAvatar) {
      icon = <UserCircleIcon size={14} />;
      label = t('timeline.userChangedAvatar', { name: senderName });
    } else {
      return null;
    }
  } else {
    return null;
  }

  return (
    <div className={css.systemMsgRow}>
      <span className={css.systemMsgIcon}>{icon}</span>
      <span className={css.systemMsgText}>{label}</span>
    </div>
  );
}
