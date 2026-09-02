import { useCallback, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { MonitorIcon, VideoCameraIcon, MicrophoneSlashIcon } from '@phosphor-icons/react';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import type { VoiceParticipant } from '@/app/features/calls/types';
import { userProfileAtom } from '@/app/store/atoms';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  useElementCallLiveState,
  uniqueMembers,
} from '@/app/features/calls/useElementCallParticipants';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId } from '@/util/matrix';
import * as css from './VoiceParticipants.css';

function ParticipantRow({
  p,
  isDominant,
  showIcons,
  roomId,
}: {
  p: VoiceParticipant;
  isDominant: boolean;
  showIcons: boolean;
  roomId?: string;
}) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const setProfile = useSetAtom(userProfileAtom);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!p.userId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setProfile({
        userId: p.userId,
        roomId,
        anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    },
    [p.userId, roomId, setProfile]
  );

  return (
    <div
      className={isDominant ? css.entrySpeaking : css.entry}
      title={p.userId ?? p.name}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      {/* Avatar — green ring when dominant speaker */}
      <div className={isDominant ? css.avatarRingSpeaking : css.avatarRing}>
        <Avatar name={p.name} mxcUrl={p.mxcAvatar} client={client ?? undefined} size="xs" />
      </div>

      {/* Name */}
      <span className={css.name}>{p.name}</span>

      {/* AV status icons — cross-fade/scale-bounce on switch */}
      {showIcons && (
        <div className={css.icons}>
          <span
            className={`${css.iconScreenshare} ${css.iconAnimated} ${p.screensharing ? css.iconVisible : css.iconHidden}`}
            title={t('voice.screensharing')}
          >
            <MonitorIcon size={12} />
          </span>
          <span
            className={`${css.iconVideo} ${css.iconAnimated} ${!p.videoMuted ? css.iconVisible : css.iconHidden}`}
            title={t('voice.cameraOn')}
          >
            <VideoCameraIcon size={12} weight="fill" />
          </span>
          <span
            className={`${css.iconMuted} ${css.iconAnimated} ${p.muted ? css.iconVisible : css.iconHidden}`}
            title={t('voice.muted')}
          >
            <MicrophoneSlashIcon size={12} />
          </span>
        </div>
      )}
    </div>
  );
}

export function VoiceParticipants({
  participants,
  localInCall,
  roomId,
}: {
  participants: VoiceParticipant[];
  localInCall: boolean;
  roomId?: string;
}) {
  if (participants.length === 0) return null;

  return (
    <div className={css.wrap}>
      {participants.map((p) => (
        <ParticipantRow
          key={p.userId ?? p.name}
          p={p}
          isDominant={p.speaking}
          showIcons={localInCall}
          roomId={roomId}
        />
      ))}
    </div>
  );
}

export function RoomVoiceParticipants({
  members,
  roomId,
}: {
  members: CallMembership[];
  roomId: string;
}) {
  const elementUi = useAtomValue(elementCallUiAtom);
  const client = getMatrixClientOrNull();
  const liveState = useElementCallLiveState(roomId);
  const localInElementCall = elementUi.roomId === roomId;

  const participants = useMemo<VoiceParticipant[]>(() => {
    const room = client?.getRoom(roomId) ?? null;
    const myUserId = client?.getUserId();

    return uniqueMembers(members).map((member) => {
      const memberInfo = room?.getMember(member.userId) ?? null;
      const live = liveState.get(member.userId);
      const isLocal = member.userId === myUserId;

      return {
        userId: member.userId,
        name: memberInfo?.name ?? formatUserId(member.userId),
        mxcAvatar: memberInfo?.getMxcAvatarUrl?.() ?? null,
        muted: localInElementCall
          ? live
            ? live.muted
            : isLocal
              ? elementUi.isMuted
              : false
          : false,
        videoMuted: localInElementCall
          ? live
            ? live.videoMuted
            : isLocal
              ? elementUi.isVideoMuted
              : true
          : true,
        screensharing: localInElementCall ? (live?.screensharing ?? false) : false,
        speaking: localInElementCall ? (live?.speaking ?? false) : false,
      };
    });
  }, [
    members,
    roomId,
    client,
    liveState,
    localInElementCall,
    elementUi.isMuted,
    elementUi.isVideoMuted,
  ]);

  if (participants.length === 0) return null;

  return (
    <VoiceParticipants
      participants={participants}
      localInCall={localInElementCall}
      roomId={roomId}
    />
  );
}
