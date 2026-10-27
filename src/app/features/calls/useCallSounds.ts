import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { elementCallEmbedAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  notificationSoundsAtom,
  notificationSoundPackAtom,
  notificationSoundVolumeAtom,
  soundOverridesAtom,
} from '@/app/store/atoms/settings';
import { playCallSound, resolveSoundPack, startCallSoundLoop } from '@/util/notificationSounds';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';
import { isVoiceRoom } from '@/util/matrix';
import { useElementCallParticipants } from './useElementCallParticipants';
import { RING_TIMEOUT_MS, useOutgoingCallState } from './useOutgoingCallState';

/**
 * Plays the call sounds of the selected notification sound pack:
 *  - ring: looped while an incoming call is being offered
 *  - ringback: looped while we are in a DM call nobody else has joined yet (outgoing ring)
 *  - callend: once when a connected call ends
 * Packs that lack a file fall back to the default pack (see getCallSoundUrl).
 */
export function useCallSounds(client: MatrixClient | null): void {
  const ui = useAtomValue(elementCallUiAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
  const soundsEnabled = useAtomValue(notificationSoundsAtom);
  const mainPack = useAtomValue(notificationSoundPackAtom);
  const overrides = useAtomValue(soundOverridesAtom);
  const volume = useAtomValue(notificationSoundVolumeAtom);
  const ringPack = resolveSoundPack('ring', mainPack, overrides);
  const ringbackPack = resolveSoundPack('ringback', mainPack, overrides);
  const callendPack = resolveSoundPack('callend', mainPack, overrides);

  const incomingKey = ui.incoming ? `${ui.incoming.roomId}:${ui.incoming.callerId}` : null;

  // Incoming call: loop `ring` until the offer is accepted, declined or times out.
  useEffect(() => {
    if (!soundsEnabled || !incomingKey || !ringPack) return undefined;
    const stop = startCallSoundLoop(ringPack, 'ring', volume);
    return () => stop?.();
  }, [soundsEnabled, incomingKey, ringPack, volume]);

  // Outgoing call: loop `ringback` while we are connected alone in a DM call.
  const { awaitingAnswer } = useOutgoingCallState(client);
  const ringbackActive = soundsEnabled && awaitingAnswer && ui.phase === 'joined';

  useEffect(() => {
    if (!ringbackActive || !ringbackPack) return undefined;
    const stop = startCallSoundLoop(ringbackPack, 'ringback', volume);
    const timer = window.setTimeout(() => stop?.(), RING_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timer);
      stop?.();
    };
  }, [ringbackActive, ringbackPack, volume, embed]);

  // Voice channels have their own join and leave sounds, for us and for the people around us.
  const joinPack = resolveSoundPack('join', mainPack, overrides);
  const leavePack = resolveSoundPack('leave', mainPack, overrides);
  const voiceSoundRef = useRef({ soundsEnabled, joinPack, leavePack });
  voiceSoundRef.current = { soundsEnabled, joinPack, leavePack };
  const voiceCallRef = useRef(false);
  const inVoiceRoom = ui.phase === 'joined' && !!embed && isVoiceRoom(embed.room);

  useEffect(() => {
    if (!inVoiceRoom) return;
    voiceCallRef.current = true;
    const { soundsEnabled: enabled, joinPack: pack } = voiceSoundRef.current;
    if (enabled && pack) playVoiceSound('join', pack);
  }, [inVoiceRoom]);

  // Others joining or leaving the voice channel we are in. The list fills in just after we join, so
  // changes in the first moments are people who were already there.
  const roomParticipants = useElementCallParticipants(inVoiceRoom && ui.roomId ? ui.roomId : '');
  const myUserId = client?.getUserId() ?? null;
  const othersKey = inVoiceRoom
    ? roomParticipants
        .map((p) => p.userId)
        .filter((id) => id !== myUserId)
        .sort()
        .join(',')
    : null;
  const othersRef = useRef<{ key: string | null; since: number }>({ key: null, since: 0 });
  useEffect(() => {
    const prev = othersRef.current;
    if (othersKey === null) {
      othersRef.current = { key: null, since: 0 };
      return;
    }
    if (prev.key === null) {
      othersRef.current = { key: othersKey, since: Date.now() };
      return;
    }
    const before = new Set(prev.key ? prev.key.split(',') : []);
    const now = new Set(othersKey ? othersKey.split(',') : []);
    const settled = Date.now() - prev.since > 3000;
    othersRef.current = { key: othersKey, since: settled ? prev.since : Date.now() };
    if (!settled) return;
    const { soundsEnabled: enabled, joinPack: jp, leavePack: lp } = voiceSoundRef.current;
    if (!enabled) return;
    // One of each per update, however many people came or went; leave first, then join.
    if ([...before].some((id) => !now.has(id)) && lp) playVoiceSound('leave', lp);
    if ([...now].some((id) => !before.has(id)) && jp) playVoiceSound('join', jp);
  }, [othersKey]);

  // Call end: once, when a connected call goes away.
  const prevCallRef = useRef<{ roomId: string | null; joined: boolean }>({
    roomId: null,
    joined: false,
  });
  const soundRef = useRef({ soundsEnabled, pack: callendPack, volume });
  soundRef.current = { soundsEnabled, pack: callendPack, volume };
  useEffect(() => {
    const prev = prevCallRef.current;
    const joined = ui.phase === 'joined';
    if (prev.roomId !== null && prev.joined && ui.roomId === null) {
      const { soundsEnabled: enabled, pack: currentPack, volume: currentVolume } = soundRef.current;
      if (voiceCallRef.current) {
        const { leavePack: leave } = voiceSoundRef.current;
        if (enabled && leave) playVoiceSound('leave', leave);
      } else if (enabled && currentPack) {
        playCallSound(currentPack, 'callend', currentVolume);
      }
    }
    if (ui.roomId === null) voiceCallRef.current = false;
    prevCallRef.current = { roomId: ui.roomId, joined };
  }, [ui.roomId, ui.phase]);
}
