import { useTranslation } from 'react-i18next';
import type { IntegrationCardData } from './useIntegrationCards';
import * as css from './IntegrationCard.css';

/** Rule texts are plain text nodes only. The icon is a locally stored data URL. */
export function IntegrationCard({ card }: { card: IntegrationCardData }) {
  const { t } = useTranslation();
  const { rule } = card;
  const icon = card.iconDataUrl?.startsWith('data:image/') ? card.iconDataUrl : undefined;
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

export function IntegrationCards({ cards }: { cards: IntegrationCardData[] }) {
  return (
    <>
      {cards.map((c) => (
        <IntegrationCard key={c.url} card={c} />
      ))}
    </>
  );
}
