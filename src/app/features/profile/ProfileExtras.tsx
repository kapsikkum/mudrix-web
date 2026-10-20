import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Room } from 'matrix-js-sdk';
import { CalendarBlankIcon } from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal';
import { linkifyParts, localTimeIn } from '@/util/profileFields';
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
export function ExpandableBio({ text, displayName }: { text: string; displayName: string }) {
  const { t } = useTranslation();
  const previewRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = previewRef.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className={cardCss.bioBox}>
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
