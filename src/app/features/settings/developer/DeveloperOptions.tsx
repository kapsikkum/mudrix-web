import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import {
  CaretUpIcon,
  CaretDownIcon,
  WarningIcon,
  EyeIcon,
  EyeSlashIcon,
  CopyIcon,
  CheckIcon,
} from '@phosphor-icons/react';
import { ClientEvent } from 'matrix-js-sdk';
import type { IClientWellKnown } from 'matrix-js-sdk/lib/client';
import { developerModeAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { ToggleRow } from '@/app/components/Toggle';
import { IconButton } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import * as css from '../Settings.css';

function getWellKnownHsUrl(client: ReturnType<typeof getMatrixClientOrNull>): string | null {
  const wk = client?.getClientWellKnown?.();
  return wk?.['m.homeserver']?.base_url ?? null;
}

export function DeveloperOptions() {
  const { t } = useTranslation();
  const [devModeEnabled, setDevModeEnabled] = useAtom(developerModeAtom);
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenExpanded, setTokenExpanded] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedHomeserver, setCopiedHomeserver] = useState(false);
  const [wkUrl, setWkUrl] = useState<string | null>(getWellKnownHsUrl(client));

  useEffect(() => {
    if (!client) return;
    const url = getWellKnownHsUrl(client);
    if (url) {
      setWkUrl(url);
      return;
    }
    const handler = (_wk: IClientWellKnown) => {
      const u = _wk?.['m.homeserver']?.base_url ?? null;
      if (u) setWkUrl(u);
    };
    client.on(ClientEvent.ClientWellKnown, handler);
    return () => {
      client.removeListener(ClientEvent.ClientWellKnown, handler);
    };
  }, [client]);

  const token = client?.getAccessToken() ?? '';
  const homeserverUrl = wkUrl ?? client?.getHomeserverUrl() ?? '';

  const handleCopyToken = () => {
    navigator.clipboard
      .writeText(token)
      .then(() => {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      })
      .catch(() => toast.error(t('common.copyFailed')));
  };

  const handleCopyHomeserver = () => {
    navigator.clipboard
      .writeText(homeserverUrl)
      .then(() => {
        setCopiedHomeserver(true);
        setTimeout(() => setCopiedHomeserver(false), 2000);
      })
      .catch(() => toast.error(t('common.copyFailed')));
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.developer.title')}</h2>

      <div className={css.section}>
        <ToggleRow
          label={t('settings.developer.enable')}
          description={t('settings.developer.enableDescription')}
          checked={devModeEnabled}
          onChange={setDevModeEnabled}
        />
      </div>

      {devModeEnabled && (
        <>
          <div className={css.section}>
            <button
              type="button"
              className={css.accessTokenBtn}
              onClick={() => setTokenExpanded(!tokenExpanded)}
            >
              {tokenExpanded ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
              {t('settings.developer.accessToken')}
            </button>

            {tokenExpanded && (
              <div className={css.tokenSection}>
                <div className={css.warningBox}>
                  <WarningIcon size={14} />
                  {t('settings.developer.accessTokenWarning')}
                </div>
                <div className={css.tokenRow}>
                  <code className={css.tokenField}>
                    {tokenVisible ? token : '••••••••••••••••'}
                  </code>
                  <IconButton
                    size="sm"
                    onClick={() => setTokenVisible(!tokenVisible)}
                    aria-label={tokenVisible ? t('common.hide') : t('common.show')}
                  >
                    {tokenVisible ? <EyeSlashIcon size={14} /> : <EyeIcon size={14} />}
                  </IconButton>
                  <IconButton size="sm" onClick={handleCopyToken} aria-label={t('common.copy')}>
                    {copiedToken ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                  </IconButton>
                </div>
              </div>
            )}
          </div>

          <div className={css.divider} />

          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('settings.developer.homeserverUrl')}</h3>
            <div className={css.tokenRow}>
              <code className={css.tokenField}>{homeserverUrl}</code>
              <IconButton size="sm" onClick={handleCopyHomeserver} aria-label={t('common.copy')}>
                {copiedHomeserver ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </IconButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
