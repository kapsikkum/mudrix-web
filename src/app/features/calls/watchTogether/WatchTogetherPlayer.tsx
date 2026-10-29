import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowSquareOutIcon,
  ArrowsOutSimpleIcon,
  EyeSlashIcon,
  XIcon,
  YoutubeLogoIcon,
} from '@phosphor-icons/react';
import { useSetAtom } from 'jotai';
import { Tooltip } from '@/app/components/Tooltip';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import {
  expectedPosition,
  watchingVideoIdAtom,
  youtubeWatchUrl,
  type WatchState,
} from './watchTogether';
import { YT_STATE, createYouTubePlayer, type YTPlayer } from './youtube';
import * as css from './WatchTogether.css';

const DRIFT_TOLERANCE_S = 1.5;
const SEEK_JUMP_S = 1.5;
const ECHO_WINDOW_MS = 1500;
const TICK_MS = 500;
// A change in the video's length with no new video means an advert has started or ended.
const DURATION_JUMP_S = 2;
// Just after an advert the player moves by itself, so for a moment nothing it does counts as this
// person pressing play, pause or seek.
const QUIET_MS = 1500;

interface Sample {
  time: number;
  at: number;
  playing: boolean;
  duration: number;
}

interface Props {
  state: WatchState;
  startedByName: string;
  compact?: boolean;
  onUpdate: (playing: boolean, position: number) => void;
  onStop: () => void;
  onFocus?: () => void;
}

export function WatchTogetherPlayer({
  state,
  startedByName,
  compact,
  onUpdate,
  onStop,
  onFocus,
}: Props) {
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
  const myIdRef = useRef(getMatrixClientOrNull()?.getUserId() ?? '');
  // Whether this player has played yet; the clock is only re-anchored for a video's first play.
  const hasPlayedRef = useRef(false);
  const inAdvertRef = useRef(false);
  const quietUntilRef = useRef(0);
  const [failed, setFailed] = useState<'video' | 'bridge' | null>(null);
  const setWatching = useSetAtom(watchingVideoIdAtom);

  // Whether a pause, play or seek in the player was this person's doing. The player is in a frame
  // we cannot hear clicks from, but the pointer being over it, or it holding the keyboard, says so.
  const userInPlayer = useCallback(() => {
    const host = hostRef.current;
    if (!host || Date.now() < quietUntilRef.current) return false;
    const doc = host.ownerDocument;
    return host.matches(':hover') || (doc.hasFocus() && host.contains(doc.activeElement));
  }, []);

  const apply = useCallback((s: WatchState) => {
    const player = playerRef.current;
    // An advert can be neither paused nor moved; once it ends the tick comes back here
    if (!player || !readyRef.current || player.isAdvert()) return;
    echoUntilRef.current = Date.now() + ECHO_WINDOW_MS;
    const target = expectedPosition(s);
    const currentId = player.getVideoData?.().video_id;
    if (currentId && currentId !== s.videoId) {
      steadyRef.current = null;
      if (s.playing) player.loadVideoById({ videoId: s.videoId, startSeconds: target });
      else player.cueVideoById({ videoId: s.videoId, startSeconds: target });
      return;
    }
    // The person who started the video re-anchors the clock when it first plays (see
    // handlePlayerState), so until then the loading time is not drift to seek over.
    const awaitingFirstPlay = !hasPlayedRef.current && s.playing && s.startedBy === myIdRef.current;
    if (!awaitingFirstPlay && Math.abs(player.getCurrentTime() - target) > DRIFT_TOLERANCE_S) {
      steadyRef.current = null;
      player.seekTo(target, true);
    }
    const playerState = player.getPlayerState();
    const running = playerState === YT_STATE.PLAYING || playerState === YT_STATE.BUFFERING;
    if (s.playing && !running) player.playVideo();
    if (!s.playing && running) player.pauseVideo();
  }, []);

  const handlePlayerState = useCallback(
    (playerState: number) => {
      const player = playerRef.current;
      const s = stateRef.current;
      const previous = lastPlayerStateRef.current;
      lastPlayerStateRef.current = playerState;
      if (!player || !s) return;
      // What an advert does says nothing about the room; the tick catches the player up when it ends
      if (player.isAdvert()) return;
      const current = player.getCurrentTime();
      const isEcho = Date.now() < echoUntilRef.current;

      if (playerState === YT_STATE.PLAYING) {
        hasPlayedRef.current = true;
        const firstStart = previous === YT_STATE.UNSTARTED || previous === YT_STATE.CUED;
        if (firstStart && Math.abs(current - expectedPosition(s)) > DRIFT_TOLERANCE_S) {
          // The shared clock started when the video was started, but the player needed a few seconds to
          // load. For the person who started it, the picture began at the start, so move the clock to
          // now instead of skipping the video ahead by however long loading took.
          if (s.playing && s.startedBy === myIdRef.current && current < DRIFT_TOLERANCE_S) {
            steadyRef.current = null;
            onUpdateRef.current(true, current);
            return;
          }
          echoUntilRef.current = Date.now() + ECHO_WINDOW_MS;
          steadyRef.current = null;
          player.seekTo(expectedPosition(s), true);
          if (!s.playing) player.pauseVideo();
          return;
        }
        if (!isEcho && !s.playing) {
          if (userInPlayer()) {
            onUpdateRef.current(true, current);
          } else {
            // It started itself (an advert ended, or the video loaded): the room is paused, so stay so
            echoUntilRef.current = Date.now() + ECHO_WINDOW_MS;
            player.pauseVideo();
          }
        }
      } else if (playerState === YT_STATE.PAUSED) {
        if (!isEcho && s.playing) {
          if (userInPlayer()) {
            onUpdateRef.current(false, current);
          } else {
            echoUntilRef.current = Date.now() + ECHO_WINDOW_MS;
            player.playVideo();
          }
        }
      } else if (playerState === YT_STATE.ENDED) {
        // Only the video really finishing ends it for everyone, not an advert that ends
        const duration = player.getDuration();
        if (s.playing && duration > 0 && expectedPosition(s) >= duration - 5) {
          onUpdateRef.current(false, duration);
        }
      }
    },
    [userInPlayer]
  );

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (host) {
      const initial = stateRef.current;
      // A video this person has just started begins at its beginning; for anyone else the clock has
      // moved on while the player loaded, so it starts where the clock is when it is told what to play.
      const justStarted = initial.startedBy === myIdRef.current && expectedPosition(initial) < 2;
      const startAt = expectedPosition(initial);
      playerRef.current = createYouTubePlayer(host, {
        videoId: initial.videoId,
        autoplay: initial.playing,
        start: () => (justStarted ? startAt : expectedPosition(stateRef.current)),
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

  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      const s = stateRef.current;
      if (!player || !readyRef.current) return;
      const playerState = player.getPlayerState();
      const current = player.getCurrentTime();
      const duration = player.getDuration();
      const now = Date.now();
      const steady = playerState === YT_STATE.PLAYING || playerState === YT_STATE.PAUSED;

      // An advert: nothing to follow or to say. Afterwards the video resumes where it left off, which
      // is behind the room, so bring it back to where the room is.
      if (player.isAdvert()) {
        inAdvertRef.current = true;
        steadyRef.current = null;
        return;
      }
      if (inAdvertRef.current) {
        inAdvertRef.current = false;
        steadyRef.current = null;
        quietUntilRef.current = now + QUIET_MS;
        apply(s);
        return;
      }

      if (now < echoUntilRef.current) {
        steadyRef.current = null;
        return;
      }

      const base = steadyRef.current;
      // A player that does not say when it is showing an advert still gives it away: the length of
      // what it is playing changes.
      if (base && steady && Math.abs(duration - base.duration) > DURATION_JUMP_S) {
        steadyRef.current = null;
        quietUntilRef.current = now + QUIET_MS;
        apply(s);
        return;
      }
      if (steady) {
        steadyRef.current = {
          time: current,
          at: now,
          playing: playerState === YT_STATE.PLAYING,
          duration,
        };
      }
      if (base && steady) {
        const maxAdvance = base.playing ? (now - base.at) / 1000 : 0;
        if (current < base.time - SEEK_JUMP_S || current > base.time + maxAdvance + SEEK_JUMP_S) {
          if (userInPlayer()) {
            onUpdateRef.current(playerState === YT_STATE.PLAYING, current);
          } else {
            // Not this person's doing (the player lost its place), so it is put right, not shared
            echoUntilRef.current = now + ECHO_WINDOW_MS;
            steadyRef.current = null;
            player.seekTo(expectedPosition(s), true);
          }
          return;
        }
      }

      // A pause the room has made that the player did not take (an advert was in the way)
      if (!s.playing && playerState === YT_STATE.PLAYING && !userInPlayer()) {
        echoUntilRef.current = now + ECHO_WINDOW_MS;
        player.pauseVideo();
        return;
      }

      const target = expectedPosition(s);
      const offBy = Math.abs(current - target);
      const drifted =
        (s.playing && playerState === YT_STATE.PLAYING && offBy > DRIFT_TOLERANCE_S) ||
        (!s.playing && playerState === YT_STATE.PAUSED && offBy > DRIFT_TOLERANCE_S);
      if (drifted) {
        echoUntilRef.current = now + ECHO_WINDOW_MS;
        steadyRef.current = null;
        player.seekTo(target, true);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [apply, userInPlayer]);

  return (
    <div className={compact ? css.playerCompact : css.player}>
      <div ref={hostRef} className={css.playerHost} />
      {failed && (
        <div className={css.playerError}>
          {failed === 'bridge'
            ? t('call.watchTogether.playerUnavailable')
            : t('call.watchTogether.unavailable')}
        </div>
      )}
      {!compact && (
        <>
          <span className={css.playerLabel}>
            <YoutubeLogoIcon size={14} weight="fill" />
            {t('call.watchTogether.startedBy', { name: startedByName })}
          </span>
          <div className={css.playerBar}>
            <span className={css.playerButtons}>
              {onFocus && (
                <Tooltip content={t('call.watchTogether.focus')}>
                  <button
                    type="button"
                    className={css.playerButton}
                    onClick={onFocus}
                    aria-label={t('call.watchTogether.focus')}
                  >
                    <ArrowsOutSimpleIcon size={14} />
                  </button>
                </Tooltip>
              )}
              <Tooltip content={t('call.watchTogether.openOnYouTube')}>
                <a
                  className={css.playerButton}
                  href={youtubeWatchUrl(state.videoId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('call.watchTogether.openOnYouTube')}
                  onClick={(e) => {
                    const current = playerRef.current?.getCurrentTime() ?? expectedPosition(state);
                    e.currentTarget.href = youtubeWatchUrl(state.videoId, current);
                  }}
                >
                  <ArrowSquareOutIcon size={14} />
                </a>
              </Tooltip>
              <Tooltip content={t('call.watchTogether.stopWatching')}>
                <button
                  type="button"
                  className={css.playerButton}
                  onClick={() => setWatching(null)}
                  aria-label={t('call.watchTogether.stopWatching')}
                >
                  <EyeSlashIcon size={14} />
                </button>
              </Tooltip>
              <Tooltip content={t('call.watchTogether.stop')}>
                <button
                  type="button"
                  className={css.playerStop}
                  onClick={onStop}
                  aria-label={t('call.watchTogether.stop')}
                >
                  <XIcon size={14} weight="bold" />
                </button>
              </Tooltip>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
