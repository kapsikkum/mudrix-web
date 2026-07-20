import { useState, useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { LinkIcon, MonitorIcon, VideoCameraIcon, MicrophoneSlashIcon } from '@phosphor-icons/react';
import {
  voiceStateAtom,
  userProfileAtom,
  reevalNowAtom,
  type VoiceParticipant,
} from '@/app/store/atoms';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import type { MatrixEvent } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { formatUserId, roomState } from '@/util/matrix';
import { VOICE_STATE_TYPE, PARTICIPANT_TTL_MS } from '@/app/hooks/voice/types';
import * as css from './VoiceParticipants.css';

/** Read active voice participants for any room directly from Matrix state events.
 *  Used when the local user is NOT in that call (no live Jitsi data available). */
function useRoomVoiceParticipantsFromState(roomId: string): VoiceParticipant[] {
  const client = getMatrixClientOrNull();

  const build = useCallback((): VoiceParticipant[] => {
    if (!client) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];

    let events = roomState(room).getStateEvents(VOICE_STATE_TYPE) ?? [];
    if (!Array.isArray(events)) events = [events];

    const result: VoiceParticipant[] = [];
    const seen = new Set<string>();

    for (const ev of events) {
      const content = ev.getContent();
      const uid = ev.getSender() ?? '';
      if (!uid || !content?.participating || seen.has(uid)) continue;
      seen.add(uid);

      // TTL check — same logic as buildParticipants in useVoice.ts
      const heartbeatTs: number | undefined = content.last_seen ?? content.joined_at;
      if (heartbeatTs && Date.now() - heartbeatTs > PARTICIPANT_TTL_MS) continue;

      const member = room.getMember(uid);
      result.push({
        userId: uid,
        name: member?.name ?? formatUserId(uid),
        mxcAvatar: member?.getMxcAvatarUrl?.() ?? null,
        jitsiId: content.jitsi_id ?? null,
        muted: content.muted ?? false,
        videoMuted: content.video_muted ?? true,
        screensharing: content.screensharing ?? false,
        external: false,
      });
    }

    return result;
  }, [client, roomId]);

  const [participants, setParticipants] = useState<VoiceParticipant[]>(build);
  const reevalNow = useAtomValue(reevalNowAtom);

  const handleEvent = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() !== VOICE_STATE_TYPE) return;
      if (event.getRoomId() !== roomId) return;
      setParticipants(build());
    },
    [build, roomId]
  );

  useMatrixEvent(client, 'RoomState.events', handleEvent);

  useEffect(() => {
    setParticipants(build());
  }, [build, reevalNow]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setParticipants(build());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [build]);

  return participants;
}

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
      title={p.external ? t('voice.externalLabel', { name: p.name }) : (p.userId ?? p.name)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(e as unknown as React.MouseEvent);
      }}
    >
      {/* Avatar — green ring when dominant speaker */}
      <div className={isDominant ? css.avatarRingSpeaking : css.avatarRing}>
        <Avatar name={p.name} mxcUrl={p.mxcAvatar} client={client ?? undefined} size="xs" />
      </div>

      {/* Name */}
      <span className={css.name}>{p.name}</span>

      {/* External badge */}
      {p.external && (
        <span className={css.externalBadge} title={t('voice.externalParticipant')}>
          <LinkIcon size={12} />
        </span>
      )}

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
  dominantSpeakerId,
  localInCall,
  roomId,
}: {
  participants: VoiceParticipant[];
  dominantSpeakerId: string | null;
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
          isDominant={!!dominantSpeakerId && p.jitsiId === dominantSpeakerId}
          showIcons={localInCall}
          roomId={roomId}
        />
      ))}
    </div>
  );
}

export function RoomVoiceParticipants({ roomId }: { roomId: string }) {
  const voiceState = useAtomValue(voiceStateAtom);

  // When the local user is in this call, use the live atom (has Jitsi AV state)
  // once it has data. Otherwise fall back to Matrix state events so observers
  // can see who's in the call.
  const localInCall = voiceState.roomId === roomId;
  const stateParticipants = useRoomVoiceParticipantsFromState(roomId);
  const participants =
    localInCall && voiceState.participants.length > 0 ? voiceState.participants : stateParticipants;
  const myUserId = getMatrixClientOrNull()?.getUserId();

  const adjustedParticipants =
    localInCall && myUserId
      ? participants.map((p) => (p.userId === myUserId ? { ...p, muted: voiceState.isMuted } : p))
      : participants;

  if (adjustedParticipants.length === 0) return null;

  return (
    <VoiceParticipants
      participants={adjustedParticipants}
      dominantSpeakerId={localInCall ? voiceState.dominantSpeakerId : null}
      localInCall={localInCall}
      roomId={roomId}
    />
  );
}
