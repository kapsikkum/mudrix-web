import { useRef } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useTranslation } from 'react-i18next';
import { SpeakerHighIcon } from '@phosphor-icons/react';
import { Popover } from '@/app/components/Popover/Popover';
import { Avatar } from '@/app/components/Avatar';
import { formatUserId } from '@/util/matrix';
import { useElementCallMemberships, uniqueMembers } from './useElementCallMemberships';
import * as css from './VoiceJoinSheet.css';

interface Props {
  client: MatrixClient;
  roomId: string;
  onJoin: () => void;
  onClose: () => void;
}

/** Phones: tapping a voice room shows who is in it first, then joins on a second tap. */
export function VoiceJoinSheet({ client, roomId, onJoin, onClose }: Props) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLElement | null>(null);
  const room = client.getRoom(roomId);
  const members = uniqueMembers(useElementCallMemberships(client, [roomId]).get(roomId) ?? []);

  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} role="dialog" className={css.sheet}>
      <div className={css.title}>
        <SpeakerHighIcon size={20} weight="fill" />
        <span className={css.roomName}>{room?.name ?? roomId}</span>
      </div>
      <div className={css.sectionLabel}>
        {members.length > 0 ? `${t('voice.inCall')} - ${members.length}` : t('voice.noOneInCall')}
      </div>
      {members.length > 0 && (
        <ul className={css.list}>
          {members.map((m) => {
            const info = room?.getMember(m.userId) ?? null;
            const name = info?.name ?? formatUserId(m.userId);
            return (
              <li key={m.userId} className={css.row}>
                <Avatar
                  name={name}
                  mxcUrl={info?.getMxcAvatarUrl?.() ?? null}
                  client={client}
                  size="sm"
                  placeholder="logo"
                />
                <span className={css.name}>{name}</span>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className={css.joinBtn} onClick={onJoin}>
        {t('voice.joinVoice')}
      </button>
      <button type="button" className={css.cancelBtn} onClick={onClose}>
        {t('common.cancel')}
      </button>
    </Popover>
  );
}
