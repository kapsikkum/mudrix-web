import { useCallback, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useAtomValue, useSetAtom } from 'jotai';
import { MicrophoneSlashIcon, SpeakerSlashIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
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
import {
  SoundboardMutedBadge,
  SoundboardPlayingChip,
} from '@/app/features/soundboard/SoundboardPersonUi';
import { useSoundboardMute } from '@/app/features/soundboard/mute';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import * as css from './VoiceParticipants.css';

function ParticipantRow({
  p,
  isDominant,
  showIcons,
  roomId,
  draggable,
}: {
  p: VoiceParticipant;
  isDominant: boolean;
  showIcons: boolean;
  roomId?: string;
  /** Someone who manages the space can drag this person to another voice channel. */
  draggable?: boolean;
}) {
  const client = getMatrixClientOrNull();
  const drag = useDraggable({
    id: `participant:${p.userId ?? p.name}:${roomId ?? ''}`,
    data: { kind: 'participant', userId: p.userId, fromRoomId: roomId },
    disabled: !draggable || !p.userId,
  });
  const setProfile = useSetAtom(userProfileAtom);
  const { t } = useTranslation();
  const { openContextMenu } = useContextMenu();
  const sbMute = useSoundboardMute(p.userId);
  const isSelf = !!p.userId && p.userId === client?.getUserId();

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
      ref={drag.setNodeRef}
      {...drag.listeners}
      style={drag.isDragging ? { opacity: 0.45 } : undefined}
      className={isDominant ? css.entrySpeaking : css.entry}
      onClick={handleClick}
      onContextMenu={(e) => {
        if (!p.userId || isSelf) return;
        const items: ContextMenuItem[] = [
          {
            label: sbMute.muted ? t('soundboard.person.unmute') : t('soundboard.person.mute'),
            onClick: sbMute.toggle,
          },
        ];
        openContextMenu(e, items);
      }}
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
        <Avatar
          name={p.name}
          mxcUrl={p.mxcAvatar}
          client={client ?? undefined}
          size="xs"
          placeholder="logo"
        />
      </div>

      {/* Name */}
      <span className={css.name}>{p.name}</span>
      <SoundboardMutedBadge userId={p.userId} />
      <SoundboardPlayingChip userId={p.userId} />

      {/* AV status icons — only active states, right-aligned in mic, camera, live order */}
      {showIcons && (
        <div className={css.icons}>
          {(p.muted || p.deafened) && (
            <span className={css.iconMicMuted}>
              <MicrophoneSlashIcon size={12} />
            </span>
          )}
          {p.deafened && (
            <span className={css.iconMicMuted}>
              <SpeakerSlashIcon size={12} />
            </span>
          )}
          {!p.videoMuted && (
            <span className={css.iconCamera}>
              <VideoCameraIcon size={12} weight="fill" />
            </span>
          )}
          {p.screensharing && <span className={css.livePill}></span>}
        </div>
      )}
    </div>
  );
}

export function VoiceParticipants({
  participants,
  localInCall,
  roomId,
  draggable,
}: {
  participants: VoiceParticipant[];
  localInCall: boolean;
  roomId?: string;
  draggable?: boolean;
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
          draggable={draggable}
        />
      ))}
    </div>
  );
}

export function RoomVoiceParticipants({
  members,
  roomId,
  draggable,
}: {
  members: CallMembership[];
  roomId: string;
  draggable?: boolean;
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
        deafened: localInElementCall && isLocal && elementUi.isDeafened,
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
    elementUi.isDeafened,
    elementUi.isVideoMuted,
  ]);

  if (participants.length === 0) return null;

  return (
    <VoiceParticipants
      participants={participants}
      localInCall={localInElementCall}
      roomId={roomId}
      draggable={draggable}
    />
  );
}
