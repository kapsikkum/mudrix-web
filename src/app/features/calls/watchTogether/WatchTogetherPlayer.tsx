import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { expectedPosition, type WatchState } from './watchTogether';
import { YT_STATE, createYouTubePlayer, type YTPlayer } from './youtube';
import * as css from './WatchTogether.css';

/** How far this player may be from the shared position before it is moved back. */
const DRIFT_TOLERANCE_S = 1.5;
/** A jump this big in the player's own time is someone scrubbing, to be shared. */
const SEEK_JUMP_S = 1.5;
/** After we move the player ourselves its next events are our own echo, not a person's action. */
const ECHO_WINDOW_MS = 1500;
const TICK_MS = 500;

interface Sample {
  time: number;
  at: number;
  playing: boolean;
}

interface Props {
  state: WatchState;
  /** Called when the person plays, pauses or scrubs this player. */
  onUpdate: (playing: boolean, position: number) => void;
}

/**
 * A YouTube player that follows the shared state: it is moved to the shared position and play
 * state, and what the person does in it (play, pause, scrub) is reported to be shared.
 */
export function WatchTogetherPlayer({ state, onUpdate }: Props) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const echoUntilRef = useRef(0);
  const lastPlayerStateRef = useRef<number>(YT_STATE.UNSTARTED);
  const steadyRef = useRef<Sample | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const [failed, setFailed] = useState<'video' | 'bridge' | null>(null);

  const apply = useCallback((s: WatchState) => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    echoUntilRef.current = Date.now() + ECHO_WINDOW_MS;
    const target = expectedPosition(s);
    const currentId = player.getVideoData?.().video_id;
    if (currentId && currentId !== s.videoId) {
      steadyRef.current = null;
      if (s.playing) player.loadVideoById({ videoId: s.videoId, startSeconds: target });
      else player.cueVideoById({ videoId: s.videoId, startSeconds: target });
      return;
    }
    if (Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S) {
      steadyRef.current = null;
      player.seekTo(target, true);
    }
    const playerState = player.getPlayerState();
    const running = playerState === YT_STATE.PLAYING || playerState === YT_STATE.BUFFERING;
    if (s.playing && !running) player.playVideo();
    if (!s.playing && running) player.pauseVideo();
  }, []);

  const handlePlayerState = useCallback((playerState: number) => {
    const player = playerRef.current;
    const s = stateRef.current;
    const previous = lastPlayerStateRef.current;
    lastPlayerStateRef.current = playerState;
    if (!player) return;
    const current = player.getCurrentTime();
    const isEcho = Date.now() < echoUntilRef.current;

    if (playerState === YT_STATE.PLAYING) {
      const firstStart = previous === YT_STATE.UNSTARTED || previous === YT_STATE.CUED;
      if (firstStart && Math.abs(current - expectedPosition(s)) > DRIFT_TOLERANCE_S) {
        echoUntilRef.current = Date.now() + ECHO_WINDOW_MS;
        steadyRef.current = null;
        player.seekTo(expectedPosition(s), true);
        if (!s.playing) player.pauseVideo();
        return;
      }
      if (!isEcho && !s.playing) onUpdateRef.current(true, current);
    } else if (playerState === YT_STATE.PAUSED) {
      if (!isEcho && s.playing) onUpdateRef.current(false, current);
    } else if (playerState === YT_STATE.ENDED) {
      if (s.playing) onUpdateRef.current(false, player.getDuration());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (host) {
      const initial = stateRef.current;
      playerRef.current = createYouTubePlayer(host, {
        videoId: initial.videoId,
        autoplay: initial.playing,
        start: expectedPosition(initial),
        onReady: () => {
          readyRef.current = true;
          apply(stateRef.current);
        },
        onStateChange: handlePlayerState,
        onError: (kind) => {
          if (!cancelled) setFailed(kind);
        },
      });
    }
    return () => {
      cancelled = true;
      readyRef.current = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [apply, handlePlayerState]);

  useEffect(() => apply(state), [state, apply]);

  useEffect(() => setFailed((kind) => (kind === 'video' ? null : kind)), [state.videoId]);

  // Watches for scrubbing and for drifting away from the shared position.
  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      const s = stateRef.current;
      if (!player || !readyRef.current) return;
      const playerState = player.getPlayerState();
      const current = player.getCurrentTime();
      const now = Date.now();
      const steady = playerState === YT_STATE.PLAYING || playerState === YT_STATE.PAUSED;
      if (now < echoUntilRef.current) {
        steadyRef.current = null;
        return;
      }

      const base = steadyRef.current;
      if (steady) {
        steadyRef.current = { time: current, at: now, playing: playerState === YT_STATE.PLAYING };
      }
      if (base && steady) {
        const maxAdvance = base.playing ? (now - base.at) / 1000 : 0;
        if (current < base.time - SEEK_JUMP_S || current > base.time + maxAdvance + SEEK_JUMP_S) {
          onUpdateRef.current(playerState === YT_STATE.PLAYING, current);
          return;
        }
      }

      const offBy = Math.abs(current - expectedPosition(s));
      const drifted =
        (s.playing && playerState === YT_STATE.PLAYING && offBy > DRIFT_TOLERANCE_S) ||
        (!s.playing && playerState === YT_STATE.PAUSED && offBy > DRIFT_TOLERANCE_S);
      if (drifted) {
        echoUntilRef.current = now + ECHO_WINDOW_MS;
        steadyRef.current = null;
        player.seekTo(expectedPosition(s), true);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={css.player}>
      <div ref={hostRef} className={css.playerHost} />
      {failed && (
        <div className={css.playerError}>
          {failed === 'bridge'
            ? t('voice.watchTogether.playerUnavailable')
            : t('voice.watchTogether.unavailable')}
        </div>
      )}
    </div>
  );
}
