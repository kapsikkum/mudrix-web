import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSetAtom, useAtom } from 'jotai';
import { credentialsAtom, clientReadyAtom, userIdAtom } from '@/app/store/atoms';
import { resume, loadCredentials } from '@/client/initMatrix';
import { AppLoading } from '@/app/components/AppLoading';

interface Props {
  children: ReactNode;
}

type Status = 'pending' | 'ready' | 'unauthenticated' | 'error';

export function RequireAuth({ children }: Props) {
  const [credentials] = useAtom(credentialsAtom);
  const setClientReady = useSetAtom(clientReadyAtom);
  const setUserId = useSetAtom(userIdAtom);
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    const creds = credentials ?? loadCredentials();
    if (!creds) {
      setStatus('unauthenticated');
      return;
    }

    let cancelled = false;
    resume(creds)
      .then((client) => {
        if (cancelled) return;
        setUserId(client.getUserId() ?? null);
        setClientReady(true);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[RequireAuth] Failed to resume session:', err);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [credentials, setUserId, setClientReady]);

  if (status === 'pending') return <AppLoading />;
  if (status === 'unauthenticated' || status === 'error') {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}
