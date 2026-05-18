import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CaretUpIcon,
  CaretDownIcon,
  WarningIcon,
  EyeIcon,
  EyeSlashIcon,
  CopyIcon,
  CheckIcon,
} from '@phosphor-icons/react';
import { getMatrixClientOrNull, logout } from '@/client/initMatrix';
import { Button, IconButton } from '@/app/components/Button';
import * as css from '../Settings.css';

export function Account() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const navigate = useNavigate();
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenExpanded, setTokenExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = client?.getAccessToken() ?? '';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.account.title')}</h2>
      <div className={css.section}>
        {/* Access token expander */}
        <button className={css.accessTokenBtn} onClick={() => setTokenExpanded(!tokenExpanded)}>
          {tokenExpanded ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
          {t('settings.account.accessToken')}
        </button>

        {tokenExpanded && (
          <div className={css.tokenSection}>
            <div className={css.warningBox}>
              <WarningIcon size={14} />
              {t('settings.account.accessTokenWarning')}
            </div>
            <div className={css.tokenRow}>
              <code className={css.tokenField}>{tokenVisible ? token : '••••••••••••••••'}</code>
              <IconButton
                size="sm"
                onClick={() => setTokenVisible(!tokenVisible)}
                title={tokenVisible ? t('common.hide') : t('common.show')}
              >
                {tokenVisible ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
              </IconButton>
              <IconButton size="sm" onClick={handleCopyToken} title={t('common.copy')}>
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </IconButton>
            </div>
          </div>
        )}
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <Button variant="danger" onClick={handleLogout}>
          {t('settings.account.logout')}
        </Button>
      </div>
    </div>
  );
}
