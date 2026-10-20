import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventShieldColour, EventShieldReason } from 'matrix-js-sdk/lib/crypto-api';
import { ShieldIcon, ShieldWarningIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { roomStateMaybe } from '@/util/matrix';
import * as css from './EventShield.css';

type ShieldKind = 'none' | 'grey' | 'warning' | 'red';

interface ShieldResult {
  kind: ShieldKind;
  reasonKey: string | null;
}

const NONE: ShieldResult = { kind: 'none', reasonKey: null };

const REASON_KEYS: Record<number, string> = {
  [EventShieldReason.UNKNOWN]: 'encryption.shield.unknown',
  [EventShieldReason.UNVERIFIED_IDENTITY]: 'encryption.shield.unverifiedIdentity',
  [EventShieldReason.UNSIGNED_DEVICE]: 'encryption.shield.unsignedDevice',
  [EventShieldReason.UNKNOWN_DEVICE]: 'encryption.shield.unknownDevice',
  [EventShieldReason.AUTHENTICITY_NOT_GUARANTEED]: 'encryption.shield.authenticity',
  [EventShieldReason.VERIFICATION_VIOLATION]: 'encryption.shield.violation',
  [EventShieldReason.MISMATCHED_SENDER]: 'encryption.shield.mismatchedSender',
};

/** Message-like event types that carry user content and are expected to be encrypted. */
const CONTENT_TYPES = new Set(['m.room.message', 'm.sticker', 'm.poll.start', 'm.poll.end']);

// Results are cached per event object so scrolling back over a message never recomputes it.
const cache = new WeakMap<MatrixEvent, ShieldResult>();

function encryptionStartTs(client: MatrixClient, event: MatrixEvent): number | null {
  const room = client.getRoom(event.getRoomId());
  const ev = roomStateMaybe(room)?.getStateEvents('m.room.encryption', '');
  const state = Array.isArray(ev) ? ev[0] : ev;
  return state ? state.getTs() : null;
}

async function computeShield(client: MatrixClient, event: MatrixEvent): Promise<ShieldResult> {
  const roomId = event.getRoomId();
  if (!roomId || event.status || event.isState() || event.isRedacted()) return NONE;
  if (!event.isEncrypted()) {
    // Unencrypted event: only a problem when it was sent after encryption was switched on.
    if (!client.getRoom(roomId)?.hasEncryptionStateEvent() || !CONTENT_TYPES.has(event.getType()))
      return NONE;
    const since = encryptionStartTs(client, event);
    if (since === null || event.getTs() < since) return NONE;
    return { kind: 'red', reasonKey: 'encryption.shield.sentInClear' };
  }
  if (event.isDecryptionFailure()) return NONE;
  const crypto = client.getCrypto();
  if (!crypto) return NONE;
  const info = await crypto.getEncryptionInfoForEvent(event);
  if (!info || info.shieldColour === EventShieldColour.NONE) return NONE;
  const reasonKey =
    info.shieldReason !== null && info.shieldReason !== undefined
      ? (REASON_KEYS[info.shieldReason] ?? 'encryption.shield.unknown')
      : 'encryption.shield.unknown';
  return { kind: info.shieldColour === EventShieldColour.RED ? 'warning' : 'grey', reasonKey };
}

/**
 * Small shield for messages from unverified/unknown devices or sent unencrypted in an
 * encrypted room. The check only runs once the element scrolls into view; verified messages
 * render nothing, so the common case stays quiet.
 */
export function EventShield({ client, event }: { client: MatrixClient; event: MatrixEvent }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLSpanElement>(null);
  const [result, setResult] = useState<ShieldResult | undefined>(() => cache.get(event));
  const [visible, setVisible] = useState(false);

  // Wait until the anchor is on screen before doing any crypto work.
  useEffect(() => {
    const cached = cache.get(event);
    if (cached) {
      setResult(cached);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [event]);

  useEffect(() => {
    if (!visible || cache.has(event)) return;
    let cancelled = false;
    const run = () => {
      computeShield(client, event)
        .then((r) => {
          cache.set(event, r);
          if (!cancelled) setResult(r);
        })
        .catch(() => {});
    };
    run();
    // Not decrypted yet: compute again once the keys arrive.
    if (event.isEncrypted() && !event.getClearContent()) {
      event.once(MatrixEventEvent.Decrypted, run);
    }
    return () => {
      cancelled = true;
      event.off(MatrixEventEvent.Decrypted, run);
    };
  }, [visible, client, event]);

  if (!result || result.kind === 'none' || !result.reasonKey) {
    return <span ref={ref} aria-hidden="true" />;
  }
  const Icon = result.kind === 'grey' ? ShieldIcon : ShieldWarningIcon;
  const kindClass =
    result.kind === 'red'
      ? css.shieldRed
      : result.kind === 'warning'
        ? css.shieldWarning
        : css.shieldGrey;
  const label = t(result.reasonKey);
  return (
    <Tooltip content={label}>
      <span ref={ref} className={`${css.shield} ${kindClass}`} role="img" aria-label={label}>
        <Icon size={13} weight="fill" />
      </span>
    </Tooltip>
  );
}
