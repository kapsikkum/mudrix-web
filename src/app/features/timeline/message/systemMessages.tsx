import { Trans } from 'react-i18next';
import { useSetAtom } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { Avatar } from '@/app/components/Avatar';
import { userProfileAtom } from '@/app/store/atoms';
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

function useProfileOpener(userId: string, roomId: string | null | undefined) {
  const setProfile = useSetAtom(userProfileAtom);
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setProfile({
      userId,
      roomId,
      anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    });
  };
}

function ProfileNameLink({
  userId,
  roomId,
  client,
  showAvatar = false,
  children,
}: {
  userId: string;
  roomId: string | null | undefined;
  client?: MatrixClient;
  showAvatar?: boolean;
  children?: React.ReactNode;
}) {
  const openProfile = useProfileOpener(userId, roomId);
  const link = (
    <button type="button" className={css.systemMsgName} onClick={openProfile}>
      {children}
    </button>
  );

  if (!showAvatar || !client) return link;

  const name = typeof children === 'string' ? children : userId;
  const mxcUrl = roomId
    ? (client.getRoom(roomId)?.getMember(userId)?.getMxcAvatarUrl() ?? null)
    : null;

  return (
    <span className={css.systemMsgInlineName}>
      <Avatar name={name} mxcUrl={mxcUrl} client={client} size="xs" onAvatarClick={openProfile} />
      {link}
    </span>
  );
}

export function SystemMessageDisplay({ event, senderName, client }: SystemMessageProps) {
  const roomId = event.getRoomId();
  const senderId = event.getSender() ?? '';
  const stateKey = event.getStateKey() ?? senderId;
  const subjectId = stateKey;
  const openProfile = useProfileOpener(subjectId, roomId);

  const subjectName = getUserName(event, client, subjectId);
  const subjectAvatar = roomId
    ? (client.getRoom(roomId)?.getMember(subjectId)?.getMxcAvatarUrl() ?? null)
    : null;

  const content = event.getContent();
  const prevContent = event.getPrevContent();
  const membership = content?.membership as string | undefined;
  const prevMembership = prevContent?.membership as string | undefined;

  let label: React.ReactNode;

  if (membership === 'join' && prevMembership !== 'join') {
    label = (
      <Trans
        i18nKey="timeline.userJoined"
        values={{ name: subjectName }}
        components={{ name: <ProfileNameLink userId={subjectId} roomId={roomId} /> }}
      />
    );
  } else if ((membership === 'leave' || membership === 'ban') && prevMembership === 'join') {
    const isKick = membership === 'leave' && senderId && stateKey && senderId !== stateKey;
    if (isKick) {
      label = (
        <Trans
          i18nKey="timeline.userKicked"
          values={{ user: subjectName, kicker: senderName }}
          components={{
            user: <ProfileNameLink userId={subjectId} roomId={roomId} />,
            kicker: (
              <ProfileNameLink userId={senderId} roomId={roomId} client={client} showAvatar />
            ),
          }}
        />
      );
    } else if (membership === 'ban') {
      label = (
        <Trans
          i18nKey="timeline.userBanned"
          values={{ name: subjectName }}
          components={{ name: <ProfileNameLink userId={subjectId} roomId={roomId} /> }}
        />
      );
    } else {
      label = (
        <Trans
          i18nKey="timeline.userLeft"
          values={{ name: subjectName }}
          components={{ name: <ProfileNameLink userId={subjectId} roomId={roomId} /> }}
        />
      );
    }
  } else {
    return null;
  }

  return (
    <div className={css.systemMsgRow}>
      <Avatar
        name={subjectName}
        mxcUrl={subjectAvatar}
        client={client}
        size="xs"
        onAvatarClick={openProfile}
      />
      <span className={css.systemMsgText}>{label}</span>
    </div>
  );
}
