import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { vars } from '@/theme/vars.css';
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

  const handleClearCache = () => {
    if (!window.confirm(t('settings.account.clearCacheConfirm'))) return;
    localStorage.clear();
    indexedDB.databases?.().then((dbs) => {
      dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name));
    });
    setTimeout(() => window.location.reload(), 500);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.account.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.account.security')}</h3>
        <div className={css.settingItem}>
          <Button variant="secondary" onClick={handleClearCache}>
            {t('settings.account.clearCache')}
          </Button>
        </div>
      </div>

      <div className={css.section}>
        {/* Access token expander */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            background: 'none',
            color: vars.color.textPrimary,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
          onClick={() => setTokenExpanded(!tokenExpanded)}
        >
          {tokenExpanded ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
          {t('settings.account.accessToken')}
        </button>

        {tokenExpanded && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: 'rgba(248,81,73,0.1)',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: vars.color.error,
              }}
            >
              <WarningIcon size={14} />
              {t('settings.account.accessTokenWarning')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
