import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/Button';
import { resolveIdpIconUrl } from '@/app/features/sso/sso';
import type { IdentityProvider } from '@/app/features/sso/sso';
import * as css from './WelcomePage.css';

interface SsoButtonsProps {
  baseUrl: string;
  idps: IdentityProvider[];
  onSso: (idpId?: string) => void;
  disabled?: boolean;
}

export function SsoButtons({ baseUrl, idps, onSso, disabled }: SsoButtonsProps) {
  const { t } = useTranslation();

  if (idps.length === 0) {
    return (
      <Button
        key="sso"
        fullWidth
        size="lg"
        variant="secondary"
        className={css.submit}
        onClick={() => onSso()}
        disabled={disabled}
      >
        {t('welcome.ssoLogin')}
      </Button>
    );
  }

  return (
    <>
      {idps.map((idp) => {
        const iconUrl = resolveIdpIconUrl(baseUrl, idp.icon);
        return (
          <Button
            key={idp.id}
            fullWidth
            size="lg"
            variant="secondary"
            className={css.submit}
            onClick={() => onSso(idp.id)}
            disabled={disabled}
          >
            {iconUrl && <img src={iconUrl} alt="" className={css.idpIcon} />}
            {t('welcome.continueWithIdp', { name: idp.name })}
          </Button>
        );
      })}
    </>
  );
}
