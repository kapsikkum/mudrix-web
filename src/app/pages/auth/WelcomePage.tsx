import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { LogoHover } from '@/app/components/AppLoading';
import * as css from './WelcomePage.css';
const version = import.meta.env.APP_VERSION ?? 'unknown';

type View = 'login' | 'register';

export function WelcomePage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('login');
  const navigate = useNavigate();
  const { homeserver } = useParams<{ homeserver?: string }>();

  const onLoginSuccess = () => navigate('/', { replace: true });
  const onRegisterSuccess = () => setView('login');

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
            defaultServerUrl={homeserver}
          />
        ) : (
          <RegisterForm
            onSuccess={onRegisterSuccess}
            onShowLogin={() => setView('login')}
            defaultServerUrl={homeserver}
          />
        )}
        <p className={css.versionText}>v{version}</p>
      </div>
    </div>
  );
}
