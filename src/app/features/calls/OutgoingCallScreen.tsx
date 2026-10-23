import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KnownMembership, type MatrixClient } from 'matrix-js-sdk';
import { PhoneIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import * as ringCss from './IncomingCallOverlay.css';
import * as css from './OutgoingCallScreen.css';

interface Props {
  client: MatrixClient;
  roomId: string;
  onHangup: () => void;
}

export function OutgoingCallScreen({ client, roomId, onHangup }: Props) {
  const { t } = useTranslation();
  const myId = client.getUserId();

  const callees = useMemo(() => {
    const room = client.getRoom(roomId);
    if (!room) return [];
    return room
      .getMembers()
      .filter(
        (member) =>
          member.userId !== myId &&
          (member.membership === KnownMembership.Join ||
            member.membership === KnownMembership.Invite)
      )
      .map((member) => ({
        userId: member.userId,
        name: member.name,
        mxcAvatar: member.getMxcAvatarUrl() ?? null,
      }));
  }, [client, roomId, myId]);

  const names = callees.map((callee) => callee.name).join(', ');

  return (
    <div className={css.screen} role="status" aria-live="polite">
      <div className={css.callees}>
        {callees.map((callee) => (
          <div key={callee.userId} className={css.calleeAvatar}>
            <Avatar
              name={callee.name}
              mxcUrl={callee.mxcAvatar}
              client={client}
              size="fill"
              placeholder="logo"
            />
          </div>
        ))}
      </div>
      <div className={ringCss.ringIdentity}>
        <div className={ringCss.ringName}>{names}</div>
        <div className={ringCss.ringNote}>{t('voice.outgoingCalling')}</div>
      </div>
      <div className={ringCss.action}>
        <button
          type="button"
          className={ringCss.btnDecline}
          onClick={onHangup}
          aria-label={t('voice.hangup')}
        >
          <PhoneIcon size={24} weight="fill" className={ringCss.iconRotated} />
        </button>
      </div>
    </div>
  );
}
