import { useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { LinkIcon, MonitorIcon, VideoCameraIcon, MicrophoneSlashIcon } from '@phosphor-icons/react';
import { voiceStateAtom, type VoiceParticipant } from '@/app/store/atoms';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { formatUserId } from '@/util/matrix';
import * as css from './VoiceParticipants.css';

const VOICE_STATE_TYPE = 'org.wizard.voice.member';
const PARTICIPANT_TTL_MS = 3 * 60_000;

/** Read active voice participants for any room directly from Matrix state events.
 *  Used when the local user is NOT in that call (no live Jitsi data available). */
function useRoomVoiceParticipantsFromState(roomId: string): VoiceParticipant[] {
  const client = getMatrixClientOrNull();

  const build = useCallback((): VoiceParticipant[] => {
    if (!client) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];

    let events = room.currentState.getStateEvents(VOICE_STATE_TYPE) ?? [];
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

  const handleEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      if (event.getType?.() !== VOICE_STATE_TYPE) return;
      if (event.getRoomId?.() !== roomId) return;
      setParticipants(build());
    },
    [build, roomId]
  );

  useMatrixEvent(client, 'RoomState.events', handleEvent);

  return participants;
}

function ParticipantRow({
  p,
  isDominant,
  showIcons,
}: {
  p: VoiceParticipant;
  isDominant: boolean;
  showIcons: boolean;
}) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();

  return (
    <div
      className={isDominant ? css.entrySpeaking : css.entry}
      title={p.external ? t('voice.externalLabel', { name: p.name }) : (p.userId ?? p.name)}
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

      {/* AV status icons — only rendered when relevant */}
      {showIcons && (
        <div className={css.icons}>
          {p.screensharing && (
            <span className={css.iconScreenshare} title={t('voice.screensharing')}>
              <MonitorIcon size={12} />
            </span>
          )}
          {!p.videoMuted && (
            <span className={css.iconVideo} title={t('voice.cameraOn')}>
              <VideoCameraIcon size={12} weight="fill" />
            </span>
          )}
          {p.muted && (
            <span className={css.iconMuted} title={t('voice.muted')}>
              <MicrophoneSlashIcon size={12} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function VoiceParticipants({
  participants,
  dominantSpeakerId,
  localInCall,
}: {
  participants: VoiceParticipant[];
  dominantSpeakerId: string | null;
  localInCall: boolean;
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
        />
      ))}
    </div>
  );
}

export function RoomVoiceParticipants({ roomId }: { roomId: string }) {
  const voiceState = useAtomValue(voiceStateAtom);

  // When the local user is in this call, use the live atom (has Jitsi AV state).
  // Otherwise fall back to Matrix state events so observers can see who's in the call.
  const localInCall = voiceState.roomId === roomId;
  const stateParticipants = useRoomVoiceParticipantsFromState(roomId);
  const participants = localInCall ? voiceState.participants : stateParticipants;

  if (participants.length === 0) return null;

  return (
    <VoiceParticipants
      participants={participants}
      dominantSpeakerId={localInCall ? voiceState.dominantSpeakerId : null}
      localInCall={localInCall}
    />
  );
}
