import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { discoverAuthCapabilities, type AuthCapabilities } from '@/app/features/sso/sso';
import { LogoHover } from '@/app/components/AppLoading';
import { prewarmCrypto, normalizeUrl } from '@/client/initMatrix';
import { languageAtom } from '@/app/store/atoms';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import * as css from './WelcomePage.css';

type View = 'login' | 'register';

export function WelcomePage() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>('login');
  const navigate = useNavigate();
  const setLanguage = useSetAtom(languageAtom);
  const { homeserver } = useParams<{ homeserver?: string }>();

  const handleLanguageChange = useCallback(
    (code: string) => {
      if (code === i18n.language) return;
      i18n.changeLanguage(code);
      setLanguage(code);
    },
    [i18n, setLanguage]
  );

  useEffect(() => {
    prewarmCrypto();
  }, []);

  const [serverSelect, setServerSelect] = useState(homeserver ? 'custom' : PRESET_SERVERS[0].value);
  const [customUrl, setCustomUrl] = useState(homeserver ?? '');
  const [version, setVersion] = useState(import.meta.env.APP_VERSION ?? 'unknown');

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then((v) => v && setVersion(v));
  }, []);

  const rawServerUrl = serverSelect === 'custom' ? customUrl : serverSelect;
  const serverUrl = normalizeUrl(rawServerUrl);

  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const discoverSeq = useRef(0);

  const discover = useCallback(async (url: string) => {
    const seq = ++discoverSeq.current;
    if (!url) {
      setCapabilities(null);
      setCapabilitiesLoading(false);
      return;
    }
    setCapabilitiesLoading(true);
    setCapabilities(null);
    try {
      const caps = await discoverAuthCapabilities(url);
      if (seq !== discoverSeq.current) return;
      setCapabilities(caps);
    } catch (err) {
      console.warn('[auth] capability discovery failed', err);
      if (seq !== discoverSeq.current) return;
      setCapabilities(null);
    } finally {
      if (seq === discoverSeq.current) setCapabilitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => discover(serverUrl), 300);
    return () => clearTimeout(timer);
  }, [serverUrl, discover]);

  const effectiveServerUrl = capabilities?.resolvedBaseUrl ?? serverUrl;

  const onLoginSuccess = () => navigate('/', { replace: true });
  const onRegisterSuccess = () => navigate('/', { replace: true });

  return (
    <div className={css.page}>
      <div className={css.langSwitcher}>
        <select
          aria-label={t('settings.preferences.languageDisplay')}
          className={css.langSelect}
          value={i18n.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
        >
          {SUPPORTED_LANGUAGES.map(({ code, labelKey }) => (
            <option key={code} value={code}>
              {t(labelKey)}
            </option>
          ))}
        </select>
      </div>
      <div className={css.container}>
        <LogoHover size={72} />
        <h1 className={css.title}>{t('welcome.title')}</h1>
        <p className={css.tagline}>{t('welcome.tagline')}</p>

        {view === 'login' ? (
          <LoginForm
            onSuccess={onLoginSuccess}
            onShowRegister={() => setView('register')}
            serverSelect={serverSelect}
            customUrl={customUrl}
            onServerSelect={setServerSelect}
            onCustomUrlChange={setCustomUrl}
            serverUrl={effectiveServerUrl}
            capabilities={capabilities}
            capabilitiesLoading={capabilitiesLoading}
            onRetryDiscovery={() => discover(serverUrl)}
          />
        ) : (
          <RegisterForm
            onSuccess={onRegisterSuccess}
            onShowLogin={() => setView('login')}
            serverSelect={serverSelect}
            customUrl={customUrl}
            onServerSelect={setServerSelect}
            onCustomUrlChange={setCustomUrl}
            serverUrl={effectiveServerUrl}
            capabilities={capabilities}
            capabilitiesLoading={capabilitiesLoading}
            onRetryDiscovery={() => discover(serverUrl)}
          />
        )}
        <p className={css.versionText}>v{version}</p>
      </div>
    </div>
  );
}
