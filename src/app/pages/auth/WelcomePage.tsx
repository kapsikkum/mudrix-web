import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { PRESET_SERVERS } from '@/app/features/sso/presetServers';
import { LogoHover } from '@/app/components/AppLoading';
import * as css from './WelcomePage.css';
const version = import.meta.env.APP_VERSION ?? 'unknown';

type View = 'login' | 'register';

export function WelcomePage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('login');
  const navigate = useNavigate();
  const { homeserver } = useParams<{ homeserver?: string }>();

  const [serverSelect, setServerSelect] = useState(homeserver ? 'custom' : PRESET_SERVERS[0].value);
  const [customUrl, setCustomUrl] = useState(homeserver ?? '');

  const onLoginSuccess = () => navigate('/', { replace: true });
  const onRegisterSuccess = () => navigate('/', { replace: true });

  return (
    <div className={css.page}>
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
          />
        ) : (
          <RegisterForm
            onSuccess={onRegisterSuccess}
            onShowLogin={() => setView('login')}
            serverSelect={serverSelect}
            customUrl={customUrl}
            onServerSelect={setServerSelect}
            onCustomUrlChange={setCustomUrl}
          />
        )}
        <p className={css.versionText}>v{version}</p>
      </div>
    </div>
  );
}
