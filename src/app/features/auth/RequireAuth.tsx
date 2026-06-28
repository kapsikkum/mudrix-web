import { type ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSetAtom, useAtom } from 'jotai';
import {
  credentialsAtom,
  clientReadyAtom,
  userIdAtom,
  serverUploadLimitAtom,
  sidebarReadyAtom,
  pendingCryptoPromptAtom,
} from '@/app/store/atoms';
import { resume, loadCredentials } from '@/client/initMatrix';
import { AppLoading, FADE_OUT_MS } from '@/app/components/AppLoading';
import { fetchServerUploadLimit } from '@/util/serverCapabilities';

interface Props {
  children: ReactNode;
}

type Status = 'pending' | 'syncing' | 'hiding' | 'ready' | 'unauthenticated' | 'error';

export function RequireAuth({ children }: Props) {
  const [credentials] = useAtom(credentialsAtom);
  const setClientReady = useSetAtom(clientReadyAtom);
  const setUserId = useSetAtom(userIdAtom);
  const setServerUploadLimit = useSetAtom(serverUploadLimitAtom);
  const setSidebarReady = useSetAtom(sidebarReadyAtom);
  const setPendingCryptoPrompt = useSetAtom(pendingCryptoPromptAtom);

  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    const creds = credentials ?? loadCredentials();
    if (!creds) {
      setStatus('unauthenticated');
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        let resolveFirstSync!: () => void;
        const firstSyncPromise = new Promise<void>((res) => {
          resolveFirstSync = res;
        });

        const client = await resume(creds, () => resolveFirstSync());
        if (cancelled) return;

        setUserId(client.getUserId() ?? null);
        setClientReady(true);

        fetchServerUploadLimit(client).then((limit) => {
          if (!cancelled) setServerUploadLimit(limit);
        });

        setStatus('syncing');

        await firstSyncPromise;
        if (cancelled) return;

        const crypto = client.getCrypto();
        if (crypto) {
          try {
            const serverInfo = await crypto.getKeyBackupInfo();
            if (serverInfo?.version) {
              const activeVersion = await crypto.getActiveSessionBackupVersion();
              if (!activeVersion) {
                setPendingCryptoPrompt('restore');
              }
            } else {
              setPendingCryptoPrompt('setup');
            }
          } catch {
            // Non-fatal — crypto check failure should not block app startup.
          }
        }

        if (cancelled) return;
        setSidebarReady(true);

        setStatus('hiding');
        setTimeout(() => {
          if (!cancelled) setStatus('ready');
        }, FADE_OUT_MS);
      } catch (err) {
        console.error('[RequireAuth] Failed to resume session:', err);
        if (!cancelled) setStatus('error');
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'unauthenticated' || status === 'error') {
    return <Navigate to="/welcome" replace />;
  }

  if (status === 'pending') return <AppLoading />;

  return (
    <>
      {children}
      {(status === 'syncing' || status === 'hiding') && <AppLoading hiding={status === 'hiding'} />}
    </>
  );
}
