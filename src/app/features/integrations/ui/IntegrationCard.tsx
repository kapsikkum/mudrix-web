import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/Button';
import { hostOf } from '../widget';
import type { IntegrationCardData } from './useIntegrationCards';
import { IntegrationViewerDialog } from './IntegrationViewerDialog';
import * as css from './IntegrationCard.css';

/** Host plus a shortened tail of the link (the part after the host can be a long secret code). */
function shortLink(url: string): string {
  try {
    const u = new URL(url);
    const tail = `${u.pathname === '/' ? '' : u.pathname}${u.search}${u.hash}`;
    const short = tail.length > 30 ? `${tail.slice(0, 20)}…${tail.slice(-6)}` : tail;
    return `${u.host}${short}`;
  } catch {
    return '';
  }
}

/** Rule texts are plain text nodes only. The icon is a locally stored data URL. */
export function IntegrationCard({ card }: { card: IntegrationCardData }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { rule, viewer } = card;
  const icon = card.iconDataUrl?.startsWith('data:image/') ? card.iconDataUrl : undefined;

  if (!viewer) {
    return (
      <div className={css.card}>
        {icon && <img src={icon} alt="" className={css.icon} />}
        <div className={css.text}>
          <span className={css.title}>{rule.title}</span>
          {rule.subtitle && <span className={css.subtitle}>{rule.subtitle}</span>}
          <span className={css.via}>
            {t('integrations.card.via', { name: card.integrationName })}
          </span>
        </div>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className={css.button}
          onClick={(e) => e.stopPropagation()}
        >
          {rule.buttonLabel || t('integrations.card.open')}
        </a>
      </div>
    );
  }

  const host = hostOf(card.url);
  const label = viewer.label || t('integrations.card.openHere');
  return (
    <div className={css.cardRich}>
      <div className={css.richHeader}>
        {icon && <img src={icon} alt="" className={css.icon} />}
        <div className={css.text}>
          <span className={css.title}>{rule.title}</span>
          {rule.subtitle && <span className={css.subtitle}>{rule.subtitle}</span>}
        </div>
      </div>
      <code className={css.linkLine} title={host}>
        {shortLink(card.url)}
      </code>
      <span className={css.note}>{t('integrations.card.nothingLoaded', { host, label })}</span>
      <div className={css.actions}>
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {label}
        </Button>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className={css.button}
          onClick={(e) => e.stopPropagation()}
        >
          {rule.buttonLabel || t('integrations.card.openInBrowser')}
        </a>
        <span className={css.via}>
          {t('integrations.card.via', { name: card.integrationName })}
        </span>
      </div>
      {open && (
        <IntegrationViewerDialog
          viewer={viewer}
          url={card.url}
          title={rule.title}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function IntegrationCards({ cards }: { cards: IntegrationCardData[] }) {
  return (
    <>
      {cards.map((c) => (
        <IntegrationCard key={c.url} card={c} />
      ))}
    </>
  );
}
