import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { autoplayGifsAtom } from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import * as css from '../Settings.css';

export function Accessibility() {
  const { t } = useTranslation();
  const [autoplayGifs, setAutoplayGifs] = useAtom(autoplayGifsAtom);

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.accessibility.title')}</h2>

      <div className={css.section}>
        <ToggleRow
          label={t('settings.accessibility.autoplayGifs')}
          description={t('settings.accessibility.autoplayGifsNote')}
          checked={autoplayGifs}
          onChange={setAutoplayGifs}
        />
      </div>
    </div>
  );
}
