import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogoLoader } from './LogoLoader';
import * as css from './AppLoading.css';

const CYCLE_MS = 2500;

export function AppLoading() {
  const { t } = useTranslation();
  const messages = t('loading.messages', { returnObjects: true }) as string[];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % messages.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className={css.overlay}>
      <LogoLoader />
      <p className={css.text}>{messages[idx]}</p>
    </div>
  );
}
