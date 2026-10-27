import { useTranslation } from 'react-i18next';
import { DiscoveryStatus, type AuthCapabilities } from '@/app/features/sso/sso';
import * as css from './WelcomePage.css';

/** Under the server box: green when a Matrix homeserver answered, red when nothing usable did. */
export function ServerStatus({
  capabilities,
  checking,
}: {
  capabilities: AuthCapabilities | null;
  checking: boolean;
}) {
  const { t } = useTranslation();
  if (checking || !capabilities) return null;
  if (capabilities.discoveryStatus === DiscoveryStatus.Ok) {
    const { software } = capabilities;
    const name = software ? [software.name, software.version].filter(Boolean).join(' ') : '';
    return (
      <p className={css.serverOk} role="status">
        {name ? t('welcome.serverDetected', { software: name }) : t('welcome.serverDetectedPlain')}
      </p>
    );
  }
  return (
    <p className={css.serverBad} role="status">
      {t('welcome.serverNotFound')}
    </p>
  );
}
