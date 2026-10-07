import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSetAtom, useAtom } from 'jotai';
import { credentialsAtom, userIdAtom, serverUploadLimitAtom } from '@/app/store/atoms';
import { resume, loadCredentials, logout } from '@/client/initMatrix';
import { AppLoading, FADE_OUT_MS } from '@/app/components/AppLoading';
import { fetchServerUploadLimit } from '@/util/serverCapabilities';
import { getErrorMessage } from '@/util/error';
import { SessionError } from './SessionError';

interface Props {
  children: ReactNode;
}

type Status = 'pending' | 'syncing' | 'hiding' | 'ready' | 'unauthenticated' | 'error';

export function RequireAuth({ children }: Props) {
  const [credentials] = useAtom(credentialsAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setServerUploadLimit = useSetAtom(serverUploadLimitAtom);

  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const creds = credentials ?? loadCredentials();
    if (!creds) {
      setStatus('unauthenticated');
      return;
    }

    let cancelled = false;
    setStatus('pending');
    setError(null);

    const init = async () => {
      try {
        let resolveFirstSync!: () => void;
        const firstSyncPromise = new Promise<void>((res) => {
          resolveFirstSync = res;
        });

        const client = await resume(creds, () => resolveFirstSync());
        if (cancelled) return;

        setUserId(client.getUserId() ?? null);

        fetchServerUploadLimit(client).then((limit) => {
          if (!cancelled) setServerUploadLimit(limit);
        });

        setStatus('syncing');

        await firstSyncPromise;
        if (cancelled) return;

        setStatus('hiding');
        setTimeout(() => {
          if (!cancelled) setStatus('ready');
        }, FADE_OUT_MS);
      } catch (err) {
        console.error('[RequireAuth] Failed to resume session:', err);
        if (!cancelled) {
          setError(getErrorMessage(err));
          setStatus('error');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (status === 'unauthenticated') {
    return <Navigate to="/welcome" replace />;
  }

  if (status === 'error') {
    const creds = credentials ?? loadCredentials();
    return (
      <SessionError
        error={error}
        onRetry={() => setAttempt((a) => a + 1)}
        onSignOut={() => {
          void logout(creds?.userId ?? null);
        }}
      />
    );
  }

  if (status === 'pending') return <AppLoading />;

  return (
    <>
      {children}
      {(status === 'syncing' || status === 'hiding') && <AppLoading hiding={status === 'hiding'} />}
    </>
  );
}
