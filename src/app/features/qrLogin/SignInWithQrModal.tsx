import { useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { AutoDiscovery, AutoDiscoveryAction, createClient } from 'matrix-js-sdk';
import { signInByGeneratingQR } from 'matrix-js-sdk/lib/rendezvous';
import { QrCodeIcon } from '@phosphor-icons/react';
import { credentialsAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Spinner } from '@/app/components/Spinner';
import {
  normalizeUrl,
  persistCredentials,
  requestPersistentStorage,
  resetClientForNewSession,
} from '@/client/initMatrix';
import { clearPendingQrSecrets, setPendingQrSecrets } from '@/client/qrLoginSecrets';
import {
  credentialsFromDeviceGrant,
  getOidcRedirectUri,
  getOrRegisterClientId,
} from '@/app/features/oidc/oidc';
import { QrCode } from './QrCode';
import { failureKey, reasonOf } from './failure';
import * as css from './QrLogin.css';

type Phase =
  | { kind: 'starting' }
  | { kind: 'showQr'; code: Uint8Array }
  | { kind: 'showCheckCode'; checkCode: string }
  | { kind: 'finishing' }
  | { kind: 'error'; messageKey: string };

async function resolveHomeserverUrl(serverName: string | undefined, fallback: string) {
  if (!serverName) return fallback;
  try {
    const config = await AutoDiscovery.findClientConfig(serverName);
    const homeserver = config['m.homeserver'];
    if (homeserver?.state === AutoDiscoveryAction.SUCCESS && homeserver.base_url) {
      return normalizeUrl(homeserver.base_url);
    }
  } catch {
    // Fall back to the server picked on the login page
  }
  return fallback;
}

function randomDeviceId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % 26]).join('');
}

export function SignInWithQrModal({
  serverUrl,
  onClose,
  onSuccess,
}: {
  serverUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const setCredentials = useSetAtom(credentialsAtom);
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const abort = new AbortController();
    let pendingKey: { userId: string; deviceId: string } | null = null;
    const fail = (messageKey: string) => {
      if (!abort.signal.aborted) setPhase({ kind: 'error', messageKey });
    };
    (async () => {
      const tempClient = createClient({ baseUrl: serverUrl });
      const flow = await signInByGeneratingQR(
        tempClient,
        (reason) => fail(failureKey(reason)),
        abort.signal
      );
      if (abort.signal.aborted || !flow.code) return;
      setPhase({ kind: 'showQr', code: flow.code });

      const { serverName } = await flow.negotiateProtocols();
      if (abort.signal.aborted) return;
      setPhase({ kind: 'showCheckCode', checkCode: flow.checkCode ?? '' });

      const homeserverUrl = await resolveHomeserverUrl(serverName, serverUrl);
      const metadata = await createClient({ baseUrl: homeserverUrl }).getAuthMetadata();
      const clientId = await getOrRegisterClientId(metadata, getOidcRedirectUri());
      await flow.deviceAuthorizationGrant({ metadata, clientId, deviceId: randomDeviceId() });

      const tokens = await flow.completeLoginOnNewDevice({ clientId });
      if (!tokens || abort.signal.aborted) return;
      setPhase({ kind: 'finishing' });

      const credentials = await credentialsFromDeviceGrant(
        homeserverUrl,
        metadata,
        clientId,
        tokens
      );
      // Cancelled while the tokens were being exchanged: do not sign in behind the person's back
      if (abort.signal.aborted) return;
      const { secrets } = await flow.shareSecrets();
      await flow.close().catch(() => {});
      if (abort.signal.aborted) return;

      // Kept across the page reload that adding a second account causes, and applied after the
      // first sync (see qrLoginSecrets.ts)
      if (secrets) setPendingQrSecrets(credentials.userId, credentials.deviceId, secrets);
      pendingKey = { userId: credentials.userId, deviceId: credentials.deviceId };
      await resetClientForNewSession(credentials.userId);
      if (abort.signal.aborted) {
        clearPendingQrSecrets(credentials.userId, credentials.deviceId);
        return;
      }
      persistCredentials(credentials);
      setCredentials(credentials);
      requestPersistentStorage();
      onSuccessRef.current();
    })().catch((err: unknown) => {
      console.error('[qrLogin]', err);
      if (pendingKey) clearPendingQrSecrets(pendingKey.userId, pendingKey.deviceId);
      fail(failureKey(reasonOf(err)));
    });
    return () => abort.abort();
  }, [serverUrl, setCredentials]);

  const renderBody = () => {
    switch (phase.kind) {
      case 'starting':
      case 'finishing':
        return <Spinner />;
      case 'showQr':
        return (
          <>
            <QrCode data={phase.code} label={t('qrLogin.qrLabel')} />
            <ol className={css.steps}>
              <li>{t('qrLogin.signInStep1')}</li>
              <li>{t('qrLogin.signInStep2')}</li>
              <li>{t('qrLogin.signInStep3')}</li>
            </ol>
          </>
        );
      case 'showCheckCode':
        return (
          <>
            <p className={css.text}>{t('qrLogin.showCode')}</p>
            <span className={css.checkCode}>{phase.checkCode}</span>
            <p className={css.text}>{t('qrLogin.waitingForApproval')}</p>
          </>
        );
      case 'error':
        return <p className={css.error}>{t(phase.messageKey)}</p>;
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('qrLogin.signInTitle')}
      titleIcon={<QrCodeIcon size={18} />}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {phase.kind === 'error' ? t('common.close') : t('common.cancel')}
        </Button>
      }
    >
      <div className={css.body}>{renderBody()}</div>
    </Modal>
  );
}
