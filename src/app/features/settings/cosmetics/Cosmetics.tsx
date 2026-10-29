import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import type { PackKind } from '@/app/hooks/useUserPacks';
import { FavoritePacks } from '../emojis/FavoritePacks';
import * as css from '@/app/components/Settings/Settings.css';

/** The cosmetic kinds, in the order their subscriptions are listed. */
const KINDS: PackKind[] = ['decoration', 'effect', 'nameplate', 'profile_frame'];

/** What you are subscribed to: every cosmetic pack you have picked from your rooms and spaces. */
export function Cosmetics() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  if (!client) return null;

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.cosmetics.title')}</h2>
      <p className={css.settingNote} style={{ marginBottom: 16 }}>
        {t('settings.cosmetics.note')}
      </p>

      {KINDS.map((kind, i) => (
        <Fragment key={kind}>
          {i > 0 && <div className={css.divider} />}
          <div className={css.section}>
            <FavoritePacks
              client={client}
              kind={kind}
              title={t(`settings.cosmetics.kindPlural.${kind}`)}
              note={t('settings.cosmetics.hint')}
              empty={t('settings.cosmetics.empty')}
            />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
