import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import {
  CalendarBlankIcon,
  SealCheckIcon,
  ShieldWarningIcon,
  ShieldIcon,
  ClockCounterClockwiseIcon,
  ChatTeardropTextIcon,
  NotePencilIcon,
  DevicesIcon,
} from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal';
import { Tooltip } from '@/app/components/Tooltip';
import { linkifyParts, localTimeIn } from '@/util/profileFields';
import { formatRelativeTime } from '@/util/format';
import { useUserVerification } from '@/app/hooks/useUserVerification';
import { useUserNotes } from '@/app/hooks/useUserNotes';
import { useUserDeviceSummary } from '@/app/hooks/useUserDeviceSummary';
import * as css from './UserProfilePopup.css';
import { getMemberSince } from './memberSince';
import * as cardCss from './ProfileCard.css';

/** Above the profile popup (z-index 7501). */
const MODAL_Z = 7600;

/**
 * Renders untrusted text as plain text with http(s) URLs turned into links. No HTML is ever
 * interpreted: every part is a React text node or an anchor built from a parsed URL.
 */
export function LinkifiedText({ text, linkClassName }: { text: string; linkClassName?: string }) {
  const parts = useMemo(() => linkifyParts(text), [text]);
  return (
    <>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className={linkClassName ?? css.bioLink}
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/** "14:32" in the user's timezone, ticking every 30 seconds, with the offset from the viewer. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const local = localTimeIn(timeZone, now, i18n.language);
  if (!local) return null;
  const { offsetHours } = local;
  const hours = Math.abs(offsetHours);
  const offsetLabel =
    offsetHours === 0
      ? t('profile.sameTime')
      : t(offsetHours > 0 ? 'profile.hoursAhead' : 'profile.hoursBehind', {
          hours: Number.isInteger(hours) ? hours : Number(hours.toFixed(1)),
        });
  return (
    <>
      <span className={css.timeValue}>{local.time}</span>
      <span className={css.timeOffset}>{offsetLabel}</span>
    </>
  );
}

/**
 * Bio preview clamped to three lines. When it doesn't fit, a "View full bio" button opens the
 * whole text in a modal.
 */
export function ExpandableBio({
  text,
  displayName,
  plain = false,
}: {
  text: string;
  displayName: string;
  plain?: boolean;
}) {
  const { t } = useTranslation();
  const previewRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className={plain ? cardCss.bioPlain : cardCss.bioBox}>
      <div ref={previewRef} className={cardCss.bioClamped}>
        <LinkifiedText text={text} />
      </div>
      {overflowing && (
        <button type="button" className={cardCss.viewBioButton} onClick={() => setOpen(true)}>
          {t('profile.viewFullBio')}
        </button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('profile.bioTitle', { name: displayName })}
        size="md"
        zIndex={MODAL_Z}
      >
        <div className={cardCss.fullBio}>
          <LinkifiedText text={text} />
        </div>
      </Modal>
    </div>
  );
}

/** "In room since Mar 4, 2024" for the room the card was opened from. Hidden when unknown. */
export function MemberSinceRow({
  room,
  userId,
}: {
  room: Room | null | undefined;
  userId: string;
}) {
  const { t, i18n } = useTranslation();
  const since = useMemo(() => getMemberSince(room, userId), [room, userId]);
  if (since === null) return null;
  const date = new Date(since).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    <div className={css.infoRow}>
      <span className={css.infoIcon}>
        <CalendarBlankIcon size={14} />
      </span>
      <span className={css.infoValue}>{t('profile.memberSince', { date })}</span>
    </div>
  );
}

/**
 * Cross-signing trust badge: "Verified" (green check), "Identity changed" (red warning, needs
 * re-approval) or "Not verified" (grey). Hidden entirely when we have no known identity for this
 * user at all (never shared an encrypted room with them), since there is nothing to report yet.
 */
export function VerificationRow({
  client,
  userId,
}: {
  client: MatrixClient | null | undefined;
  userId: string;
}) {
  const { t } = useTranslation();
  const status = useUserVerification(client, userId);
  if (!status || !status.known) return null;

  const Icon = status.needsApproval
    ? ShieldWarningIcon
    : status.verified
      ? SealCheckIcon
      : ShieldIcon;
  const label = status.needsApproval
    ? t('profile.identityChanged')
    : status.verified
      ? t('profile.verifiedUser')
      : t('profile.notVerifiedUser');
  const valueClass = status.needsApproval
    ? cardCss.verificationWarning
    : status.verified
      ? cardCss.verificationOk
      : css.infoValue;

  return (
    <div className={css.infoRow}>
      <span className={css.infoIcon}>
        <Icon size={14} weight={status.verified ? 'fill' : 'regular'} />
      </span>
      <span className={valueClass}>{label}</span>
    </div>
  );
}

/** Legacy presence status message (set via /status in old clients), kept distinct from the
 * cosmetic custom status shown as a pill next to the display name. */
export function StatusMessageRow({ statusMsg }: { statusMsg: string | undefined }) {
  if (!statusMsg) return null;
  return (
    <div className={css.infoRow}>
      <span className={css.infoIcon}>
        <ChatTeardropTextIcon size={14} />
      </span>
      <span className={css.infoValue}>
        <LinkifiedText text={statusMsg} />
      </span>
    </div>
  );
}

/** "Last seen 5 minutes ago" from legacy presence, shown only while the user isn't live-online. */
export function LastActiveRow({
  client,
  userId,
  isOnline,
}: {
  client: MatrixClient | null | undefined;
  userId: string;
  isOnline: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (isOnline || !client) return null;
  const user = client.getUser(userId);
  if (!user || typeof user.lastActiveAgo !== 'number' || !user.lastPresenceTs) return null;
  const lastActiveTs = user.lastPresenceTs - user.lastActiveAgo;
  if (!Number.isFinite(lastActiveTs) || lastActiveTs <= 0) return null;
  return (
    <div className={css.infoRow}>
      <span className={css.infoIcon}>
        <ClockCounterClockwiseIcon size={14} />
      </span>
      <Tooltip content={new Date(lastActiveTs).toLocaleString(i18n.language)}>
        <span className={css.infoValue}>
          {t('profile.lastSeen', { time: formatRelativeTime(lastActiveTs, t, i18n.language) })}
        </span>
      </Tooltip>
    </div>
  );
}

/** "3 sessions (2 verified)" - how many devices this user is signed in on. */
export function DeviceSummaryRow({
  client,
  userId,
}: {
  client: MatrixClient | null | undefined;
  userId: string;
}) {
  const { t } = useTranslation();
  const summary = useUserDeviceSummary(client, userId);
  if (!summary) return null;
  return (
    <div className={css.infoRow}>
      <span className={css.infoIcon}>
        <DevicesIcon size={14} />
      </span>
      <span className={css.infoValue}>
        {t('profile.sessionCount', { count: summary.count })}
        {summary.verifiedCount > 0 &&
          ` (${t('profile.sessionsVerified', { count: summary.verifiedCount })})`}
      </span>
    </div>
  );
}

/**
 * Discord-style private note about this user: only the viewer can see it, synced to their
 * account (not sent to the person it's about) so it follows them across devices.
 */
export function NotesSection({
  client,
  userId,
}: {
  client: MatrixClient | null | undefined;
  userId: string;
}) {
  const { t } = useTranslation();
  const { getNote, saveNote } = useUserNotes(client);
  const stored = getNote(userId);
  const [draft, setDraft] = useState(stored);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserIdRef = useRef(userId);

  // Reset the draft when the popup switches to a different user.
  if (lastUserIdRef.current !== userId) {
    lastUserIdRef.current = userId;
    if (draft !== stored) setDraft(stored);
  }

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    []
  );

  return (
    <div className={css.notesSection}>
      <span className={css.notesLabel}>
        <NotePencilIcon size={14} />
        {t('profile.notes')}
      </span>
      <textarea
        className={css.notesTextarea}
        value={draft}
        placeholder={t('profile.notesPlaceholder')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === stored) return;
          saveNote(userId, draft);
          setShowSaved(true);
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
          savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
        }}
      />
      <span className={css.notesSaved} data-visible={showSaved}>
        {t('profile.notesSaved')}
      </span>
    </div>
  );
}

/**
 * Discord's Activity tab shows rich presence (what game someone's playing) via a protocol
 * Matrix has no equivalent of for other users, so there's no "now playing" data to show here.
 * Instead this surfaces real activity we do have: how much this person has posted in the
 * current room and their most recent message, Discord-board-styled.
 */
export function ActivityPanel({ room, userId }: { room: Room | null | undefined; userId: string }) {
  const { t, i18n } = useTranslation();

  const stats = useMemo(() => {
    if (!room) return null;
    const events = room.getLiveTimeline().getEvents();
    const mine = events.filter((e) => {
      if (e.getSender() !== userId || e.isRedacted()) return false;
      const type = e.getType();
      return type === 'm.room.message' || type === 'm.sticker';
    });
    if (mine.length === 0)
      return { count: 0, recentBody: null as string | null, recentTs: null as number | null };
    const last = mine[mine.length - 1];
    const bodyRaw = last.getContent()?.body;
    const body = typeof bodyRaw === 'string' ? bodyRaw : '';
    const recentBody = body.length > 140 ? `${body.slice(0, 140)}…` : body;
    return { count: mine.length, recentBody: recentBody || null, recentTs: last.getTs() };
  }, [room, userId]);

  if (!stats) return null;

  return (
    <div className={cardCss.activityCard}>
      <span className={cardCss.activityCardTitle}>{t('profile.activity.title')}</span>
      {stats.count === 0 ? (
        <span className={cardCss.activityMeta}>{t('profile.activity.none')}</span>
      ) : (
        <>
          {stats.recentBody && (
            <blockquote className={cardCss.activityQuote}>{stats.recentBody}</blockquote>
          )}
          <span className={cardCss.activityMeta}>
            {t('profile.activity.messageCount', { count: stats.count })}
            {stats.recentTs !== null &&
              ` · ${formatRelativeTime(stats.recentTs, t, i18n.language)}`}
          </span>
        </>
      )}
      <span className={cardCss.activityMeta}>{t('profile.activity.localNote')}</span>
    </div>
  );
}
