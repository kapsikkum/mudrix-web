import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { SpinnerGapIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { emojiVerificationAtom } from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';
import { AuthType } from 'matrix-js-sdk/lib/interactive-auth';
import type { IAuthData } from 'matrix-js-sdk/lib/interactive-auth';
import { MatrixError } from 'matrix-js-sdk/lib/http-api/errors';
import { VerificationPhase, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api';
import type {
  VerificationRequest,
  ShowSasCallbacks,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import { UiaPanel, offersPassword, offersSso } from './UiaPanel';
import type { UiaChallenge } from './UiaPanel';
import { DeviceCard } from './DeviceCard';
import type { DeviceEntry } from './DeviceCard';
import { waitForSsoFallback } from '@/app/features/sso/sso';
import * as css from './Sessions.css';
import * as layoutCss from '../Settings.css';

const DEVICE_DELETE_ACTIONS = [
  'org.matrix.device_delete',
  'org.matrix.device_view',
  'org.matrix.session_view',
  'session_view',
];

interface AccountManagementInfo {
  url: string;
  actionsSupported?: string[];
}

async function getAccountManagementInfo(
  client: MatrixClient
): Promise<AccountManagementInfo | null> {
  try {
    const meta = await client.getAuthMetadata();
    if (!meta.account_management_uri) return null;
    return {
      url: meta.account_management_uri,
      actionsSupported: meta.account_management_actions_supported,
    };
  } catch {
    return null;
  }
}

function buildAccountManagementUrl(info: AccountManagementInfo, deviceId: string): string {
  const action =
    DEVICE_DELETE_ACTIONS.find(
      (a) => !info.actionsSupported || info.actionsSupported.includes(a)
    ) ?? 'org.matrix.device_delete';

  const url = new URL(info.url);
  url.searchParams.set('action', action);
  url.searchParams.set('device_id', deviceId);
  return url.toString();
}

function asMatrixError(err: unknown): MatrixError | null {
  return err instanceof MatrixError ? err : null;
}

async function startDeviceVerification(
  request: VerificationRequest,
  setEmojiModal: ReturnType<typeof useSetAtom<typeof emojiVerificationAtom>>
) {
  setEmojiModal({ open: true, request, phase: 'waiting', otherUserId: request.otherUserId });

  const onRequestChange = async () => {
    const phase = request.phase;
    if (phase === VerificationPhase.Ready || phase === VerificationPhase.Requested) {
      if (!request.chosenMethod) {
        try {
          const verifier = await request.startVerification('m.sas.v1');
          verifier.on(VerifierEvent.ShowSas, (sasCallbacks: ShowSasCallbacks) => {
            setEmojiModal((prev) => ({
              ...prev,
              phase: 'comparing',
              emojis: sasCallbacks.sas.emoji ?? [],
              sasCallbacks,
            }));
          });
          verifier.on(VerifierEvent.Cancel, () => {
            setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
          });
          verifier.verify().catch(() => {
            setEmojiModal((prev) =>
              prev.phase !== 'done' ? { ...prev, phase: 'cancelled' } : prev
            );
          });
        } catch {
          setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
        }
      }
    }
    if (phase === VerificationPhase.Started && request.verifier) {
      const verifier = request.verifier;
      verifier.on(VerifierEvent.ShowSas, (sasCallbacks: ShowSasCallbacks) => {
        setEmojiModal((prev) => ({
          ...prev,
          phase: 'comparing',
          emojis: sasCallbacks.sas.emoji ?? [],
          sasCallbacks,
        }));
      });
      verifier.on(VerifierEvent.Cancel, () => {
        setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
      });
      verifier.verify().catch(() => {
        setEmojiModal((prev) => (prev.phase !== 'done' ? { ...prev, phase: 'cancelled' } : prev));
      });
    }
    if (phase === VerificationPhase.Done) {
      setEmojiModal((prev) => ({ ...prev, phase: 'done' }));
    }
    if (phase === VerificationPhase.Cancelled) {
      setEmojiModal((prev) => (prev.phase !== 'done' ? { ...prev, phase: 'cancelled' } : prev));
    }
  };

  request.on('change' as Parameters<typeof request.on>[0], onRequestChange);
}

export function Sessions() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setEmojiModal = useSetAtom(emojiVerificationAtom);
  const confirmDialog = useConfirm();

  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uiaChallenge, setUiaChallenge] = useState<UiaChallenge | null>(null);
  const [uiaSubmitting, setUiaSubmitting] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const confirm = useCallback(
    (title: string, message: string, danger = false): Promise<boolean> =>
      confirmDialog({ title, message, danger }),
    [confirmDialog]
  );

  const loadDevices = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const crypto = client.getCrypto();
      const ownDeviceId = client.getDeviceId() ?? '';
      const ownUserId = client.getUserId() ?? '';

      const res = await client.getDevices();
      const rawDevices: { device_id: string; display_name?: string; user_id?: string }[] =
        res.devices ?? [];

      const verificationResults = await Promise.all(
        rawDevices.map(async (d) => {
          if (!crypto) return null;
          try {
            const status = await crypto.getDeviceVerificationStatus(
              d.user_id ?? ownUserId,
              d.device_id
            );
            if (!status) return false;
            return status.isVerified();
          } catch {
            return false;
          }
        })
      );

      const entries: DeviceEntry[] = rawDevices.map((d, i) => ({
        deviceId: d.device_id,
        displayName: d.display_name || d.device_id,
        isCurrentDevice: d.device_id === ownDeviceId,
        isVerified: verificationResults[i] as boolean | null,
      }));

      entries.sort((a, b) => {
        if (a.isCurrentDevice) return -1;
        if (b.isCurrentDevice) return 1;
        if (a.isVerified === false && b.isVerified !== false) return -1;
        if (b.isVerified === false && a.isVerified !== false) return 1;
        return 0;
      });

      setDevices(entries);
    } catch (err) {
      toastRef.current.error(
        t('settings.sessions.loadSessionsFailed', { error: getErrorMessage(err) })
      );
    } finally {
      setLoading(false);
    }
  }, [client, t]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const loadDevicesRef = useRef(loadDevices);
  loadDevicesRef.current = loadDevices;

  const tryDeleteDevice = useCallback(
    async (deviceId: string, auth?: Record<string, unknown>): Promise<IAuthData | null> => {
      if (!client) return null;
      try {
        await client.deleteDevice(deviceId, auth as Parameters<typeof client.deleteDevice>[1]);
        return null;
      } catch (err) {
        const mErr = asMatrixError(err);
        if (mErr?.httpStatus === 401) return mErr.data as unknown as IAuthData;
        throw err;
      }
    },
    [client]
  );

  const handleUiaPassword = useCallback(
    async (password: string) => {
      if (!client || !uiaChallenge) return;
      setUiaSubmitting(true);
      try {
        const authDict = {
          type: AuthType.Password,
          identifier: { type: 'm.id.user', user: client.getUserId() ?? '' },
          password,
          session: uiaChallenge.authData.session ?? '',
        };
        const stillNeeded = await tryDeleteDevice(uiaChallenge.deviceId, authDict);
        if (stillNeeded) throw new Error('Additional auth stages required');
        toastRef.current.success(
          t('settings.sessions.sessionRemoved', { name: uiaChallenge.displayName })
        );
        setUiaChallenge(null);
        setActionLoading(null);
        await loadDevicesRef.current();
      } finally {
        setUiaSubmitting(false);
      }
    },
    [client, uiaChallenge, tryDeleteDevice, t]
  );

  const handleUiaSso = useCallback(async () => {
    if (!client || !uiaChallenge) return;
    const session = uiaChallenge.authData.session;
    if (!session) return;

    setUiaSubmitting(true);
    try {
      const fallbackUrl = client.getFallbackAuthUrl(AuthType.Sso, session);
      await waitForSsoFallback(fallbackUrl, client.getHomeserverUrl());

      const stillNeeded = await tryDeleteDevice(uiaChallenge.deviceId, { session });
      if (stillNeeded) throw new Error('Additional auth stages required');

      toastRef.current.success(
        t('settings.sessions.sessionRemoved', { name: uiaChallenge.displayName })
      );
      setUiaChallenge(null);
      setActionLoading(null);
      await loadDevicesRef.current();
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'sso_popup_closed'
          ? t('settings.sessions.ssoCancelled')
          : t('settings.sessions.removeSessionFailed', { error: getErrorMessage(err) });
      toastRef.current.error(message);
    } finally {
      setUiaSubmitting(false);
    }
  }, [client, uiaChallenge, tryDeleteDevice, t]);

  const handleUiaCancel = useCallback(() => {
    setUiaChallenge(null);
    setActionLoading(null);
  }, []);

  const handleNonUiaError = useCallback(
    async (deviceId: string, displayName: string, accountInfo: AccountManagementInfo | null) => {
      if (!client) return;
      if (accountInfo) {
        window.open(
          buildAccountManagementUrl(accountInfo, deviceId),
          '_blank',
          'noopener,noreferrer'
        );
        toastRef.current.info(t('settings.sessions.accountManagementOpened'));
        return;
      }
      try {
        const authData = await tryDeleteDevice(deviceId);
        if (authData === null) {
          await loadDevicesRef.current();
          return;
        }
        if (offersPassword(authData.flows) || offersSso(authData.flows)) {
          setUiaChallenge({ authData, deviceId, displayName });
          return;
        }
      } catch {
        // fall through to error toast
      }
      toastRef.current.error(t('settings.sessions.sessionNotSupported'));
    },
    [client, tryDeleteDevice, t]
  );

  const handleRemove = useCallback(
    async (deviceId: string, displayName: string) => {
      if (!client) return;
      const ok = await confirm(
        t('settings.sessions.removeSession'),
        t('settings.sessions.removeSessionConfirm', { name: displayName }),
        true
      );
      if (!ok) return;
      if (actionLoading) return;
      setActionLoading(deviceId);

      const accountInfo = await getAccountManagementInfo(client);
      if (accountInfo) {
        await handleNonUiaError(deviceId, displayName, accountInfo);
        setActionLoading(null);
        return;
      }

      try {
        const authData = await tryDeleteDevice(deviceId);
        if (authData === null) {
          toastRef.current.success(t('settings.sessions.sessionRemoved', { name: displayName }));
          await loadDevicesRef.current();
          setActionLoading(null);
          return;
        }
        const flows = authData.flows;
        if (!offersPassword(flows) && !offersSso(flows)) {
          await handleNonUiaError(deviceId, displayName, null);
          setActionLoading(null);
          return;
        }
        setUiaChallenge({ authData, deviceId, displayName });
      } catch (err) {
        const mErr = asMatrixError(err);
        if (!mErr || mErr.httpStatus !== 401) {
          await handleNonUiaError(deviceId, displayName, null);
        } else {
          toastRef.current.error(
            t('settings.sessions.removeSessionFailed', { error: getErrorMessage(err) })
          );
        }
        setActionLoading(null);
      }
    },
    [client, actionLoading, confirm, tryDeleteDevice, handleNonUiaError, t]
  );

  const handleVerify = useCallback(
    async (deviceId: string) => {
      if (!client) return;
      const crypto = client.getCrypto();
      if (!crypto) {
        toastRef.current.error(t('settings.sessions.cryptoNotAvailable'));
        return;
      }
      setActionLoading(deviceId);
      try {
        const request = await crypto.requestDeviceVerification(client.getUserId() ?? '', deviceId);
        await startDeviceVerification(request, setEmojiModal);
        const waitForDone = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              const p = request.phase;
              if (p === VerificationPhase.Done || p === VerificationPhase.Cancelled) resolve();
              else request.once('change' as Parameters<typeof request.once>[0], check);
            };
            check();
          });
        waitForDone().then(() => loadDevicesRef.current());
      } catch (err) {
        toastRef.current.error(
          t('settings.sessions.startVerificationFailed', { error: getErrorMessage(err) })
        );
      } finally {
        setActionLoading(null);
      }
    },
    [client, setEmojiModal, t]
  );

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('settings.sessions.title')}</h2>

      <div className={layoutCss.section}>
        <h3 className={layoutCss.sectionTitle}>{t('settings.sessions.yourDevices')}</h3>
        <p className={css.sessionNote}>{t('settings.sessions.devicesDescription')}</p>

        {uiaChallenge && (
          <UiaPanel
            challenge={uiaChallenge}
            onSubmitPassword={handleUiaPassword}
            onSso={handleUiaSso}
            onCancel={handleUiaCancel}
            submitting={uiaSubmitting}
          />
        )}

        {!uiaChallenge && (
          <div className={css.sessionActions}>
            <button
              type="button"
              className={layoutCss.actionBtnSecondary}
              onClick={loadDevices}
              disabled={loading}
            >
              <ArrowClockwiseIcon size={14} />
              {t('common.refresh')}
            </button>
          </div>
        )}

        {loading ? (
          <div className={css.spinner}>
            <SpinnerGapIcon size={20} className="icon-spin" />
          </div>
        ) : devices.length === 0 ? (
          <p className={css.emptyState}>{t('settings.sessions.noSessionsFound')}</p>
        ) : (
          <div className={css.deviceList}>
            {devices.map((d) => (
              <DeviceCard
                key={d.deviceId}
                device={d}
                actionLoading={actionLoading}
                onVerify={handleVerify}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
