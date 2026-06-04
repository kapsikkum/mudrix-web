import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { SignInIcon, SignOutIcon, UserCircleIcon } from '@phosphor-icons/react';
import * as css from '../Timeline.css';

interface SystemMessageProps {
  event: MatrixEvent;
  senderName: string;
  client: MatrixClient;
}

function getUserName(event: MatrixEvent, client: MatrixClient, userId: string): string {
  const roomId = event.getRoomId();
  if (!roomId) return userId;
  const member = client.getRoom(roomId)?.getMember(userId);
  return member?.name ?? userId;
}

export function SystemMessageDisplay({ event, senderName, client }: SystemMessageProps) {
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
    const sender = event.getSender();
    const stateKey = event.getStateKey();
    const isKick = membership === 'leave' && sender && stateKey && sender !== stateKey;
    if (isKick) {
      const kickedName = getUserName(event, client, stateKey);
      icon = <SignOutIcon size={14} />;
      label = t('timeline.userKicked', { user: kickedName, kicker: senderName });
    } else {
      icon = <SignOutIcon size={14} />;
      label =
        membership === 'ban'
          ? t('timeline.userBanned', { name: senderName })
          : t('timeline.userLeft', { name: senderName });
    }
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
