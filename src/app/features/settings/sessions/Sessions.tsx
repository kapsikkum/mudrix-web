import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
  SpinnerGapIcon,
  ArrowClockwiseIcon,
  SignOutIcon,
  ShieldCheckIcon,
  QrCodeIcon,
} from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { getMatrixClientOrNull, logout } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { emojiVerificationAtom } from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';
import type { IAuthData } from 'matrix-js-sdk/lib/interactive-auth';
import { MatrixError } from 'matrix-js-sdk/lib/http-api/errors';
import { isSignInWithQRAvailable } from 'matrix-js-sdk/lib/rendezvous';
import { LinkDeviceModal } from '@/app/features/qrLogin/LinkDeviceModal';
import { ToggleRow } from '@/app/components/Toggle';
import { applyDeviceIsolation } from '@/client/deviceIsolation';
import { excludeInsecureSessionsAtom } from '@/app/store/atoms';
import { VerificationPhase, CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import { startSasVerification } from '@/app/features/device/startSasVerification';
import { UiaPanel } from './UiaPanel';
import { useUiaAction } from '../useUiaAction';
import { openSafeExternalUrl } from '@/util/safeUrl';
import { Button } from '@/app/components/Button';
import { DeviceCard } from './DeviceCard';
import type { DeviceEntry } from './DeviceCard';
import { RecoveryKeyBox } from './RecoveryKeyBox';
import { RoomKeysBackup } from './RoomKeysBackup';
import { KeyBackupStatus } from './KeyBackupStatus';
import { useRecoverySnapshot } from '@/app/features/keybackup/recoveryState';
import { useRecoveryKeyActions } from './useRecoveryKeyActions';
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

export function Sessions() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setEmojiModal = useSetAtom(emojiVerificationAtom);
  const confirmDialog = useConfirm();

  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const uia = useUiaAction({
    client,
    onSuccess: async (ctx) => {
      toastRef.current.success(
        t('settings.sessions.sessionRemoved', {
          name: ctx.displayName || '',
        })
      );
      setActionLoading(null);
      await loadDevicesRef.current();
    },
    onError: (err) => {
      setActionLoading(null);
      const mErr = asMatrixError(err);
      if (!mErr || mErr.httpStatus !== 401) {
        toastRef.current.error(t('settings.sessions.sessionNotSupported'));
      } else {
        toastRef.current.error(
          t('settings.sessions.removeSessionFailed', { error: getErrorMessage(err) })
        );
      }
    },
  });

  const {
    loading: recoveryLoading,
    mode: recoveryMode,
    handleSetup,
    handleRestore,
    handleRegenerate,
  } = useRecoveryKeyActions(client);
  const recoverySnapshot = useRecoverySnapshot(client);
  const [excludeInsecure, setExcludeInsecure] = useAtom(excludeInsecureSessionsAtom);

  // Linking another device by QR code needs a homeserver that supports it (MSC4108).
  const [qrLinkAvailable, setQrLinkAvailable] = useState(false);
  const [linkingDevice, setLinkingDevice] = useState(false);
  useEffect(() => {
    if (!client) return undefined;
    let cancelled = false;
    void isSignInWithQRAvailable(client)
      .catch(() => false)
      .then((available) => {
        if (!cancelled) setQrLinkAvailable(available);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const emojiState = useAtomValue(emojiVerificationAtom);
  const verificationTeardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!emojiState.open) {
      verificationTeardownRef.current?.();
      verificationTeardownRef.current = null;
    }
  }, [emojiState.open]);

  useEffect(
    () => () => {
      verificationTeardownRef.current?.();
      verificationTeardownRef.current = null;
    },
    []
  );

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
      const rawDevices: {
        device_id: string;
        display_name?: string;
        user_id?: string;
        last_seen_ip?: string;
        last_seen_ts?: number;
      }[] = res.devices ?? [];

      const verificationResults = await Promise.all(
        rawDevices.map(async (d) => {
          if (!crypto) return null;
          try {
            const status = await crypto.getDeviceVerificationStatus(
              d.user_id ?? ownUserId,
              d.device_id
            );
            if (!status) return false;
            if (d.device_id === ownDeviceId) {
              return status.crossSigningVerified;
            }
            return status.signedByOwner || status.localVerified;
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
        lastSeenIp: d.last_seen_ip ?? null,
        lastSeenTs: d.last_seen_ts ?? null,
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

  const reloadTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    const scheduleReload = () => {
      window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = window.setTimeout(() => loadDevicesRef.current(), 300);
    };
    client.on(CryptoEvent.DevicesUpdated as Parameters<typeof client.on>[0], scheduleReload);
    return () => {
      client.off(CryptoEvent.DevicesUpdated as Parameters<typeof client.off>[0], scheduleReload);
      window.clearTimeout(reloadTimerRef.current);
    };
  }, [client]);

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

  const handleNonUiaError = useCallback(
    async (deviceId: string, _displayName: string, accountInfo: AccountManagementInfo | null) => {
      if (!client) return;
      if (accountInfo) {
        openSafeExternalUrl(buildAccountManagementUrl(accountInfo, deviceId));
        toastRef.current.info(t('settings.sessions.accountManagementOpened'));
        return;
      }
      toastRef.current.error(t('settings.sessions.sessionNotSupported'));
    },
    [client, t]
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

      await uia.execute((auth) => tryDeleteDevice(deviceId, auth), { deviceId, displayName });
      setActionLoading(null);
    },
    [client, actionLoading, confirm, tryDeleteDevice, handleNonUiaError, t, uia]
  );

  const handleRename = useCallback(
    async (deviceId: string, newName: string) => {
      if (!client) return;
      const trimmed = newName.trim();
      if (!trimmed) return;
      setActionLoading(deviceId);
      try {
        await client.setDeviceDetails(deviceId, { display_name: trimmed });
        await loadDevicesRef.current();
      } catch (err) {
        toastRef.current.error(
          t('settings.sessions.renameSessionFailed', { error: getErrorMessage(err) })
        );
      } finally {
        setActionLoading(null);
      }
    },
    [client, t]
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
        verificationTeardownRef.current?.();
        verificationTeardownRef.current = startSasVerification(request, setEmojiModal);
        const waitForDone = () =>
          new Promise<'done' | 'cancelled'>((resolve) => {
            const check = () => {
              const p = request.phase;
              if (p === VerificationPhase.Done || p === VerificationPhase.Cancelled)
                resolve(p === VerificationPhase.Done ? 'done' : 'cancelled');
              else request.once('change' as Parameters<typeof request.once>[0], check);
            };
            check();
          });
        waitForDone().then((outcome) => {
          if (outcome === 'done') loadDevicesRef.current();
        });
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

  const handleVerifyCurrentDevice = useCallback(async () => {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto) {
      toastRef.current.error(t('settings.sessions.cryptoNotAvailable'));
      return;
    }
    try {
      const request = await crypto.requestOwnUserVerification();
      verificationTeardownRef.current?.();
      verificationTeardownRef.current = startSasVerification(request, setEmojiModal);
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
    } catch {
      // No eligible verified device to approve, or the request couldn't start.
    }
  }, [client, setEmojiModal, t]);

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('settings.sessions.title')}</h2>

      {linkingDevice && client && (
        <LinkDeviceModal
          client={client}
          onClose={() => {
            setLinkingDevice(false);
            void loadDevices();
          }}
        />
      )}

      {(() => {
        const currentDevice = devices.find((d) => d.isCurrentDevice);
        const otherDevices = devices.filter((d) => !d.isCurrentDevice);
        const canVerifyWithOtherDevice =
          !!currentDevice &&
          currentDevice.isVerified === false &&
          otherDevices.some((d) => d.isVerified === true);

        return (
          <>
            <div className={layoutCss.section}>
              <h3 className={layoutCss.sectionTitle}>{t('settings.sessions.currentDevice')}</h3>
              {loading ? (
                <div className={css.spinner}>
                  <SpinnerGapIcon size={20} className="icon-spin" />
                </div>
              ) : currentDevice ? (
                <DeviceCard
                  device={currentDevice}
                  actionLoading={actionLoading}
                  onVerify={handleVerify}
                  onRemove={handleRemove}
                  onRename={handleRename}
                  belowRow={
                    <>
                      {currentDevice.isVerified === false && recoveryMode !== 'loading' ? (
                        <RecoveryKeyBox
                          mode={
                            recoveryMode === 'none' && !recoverySnapshot.secretStorageExists
                              ? 'none'
                              : 'available'
                          }
                          onSetup={async () => {
                            await handleSetup();
                            await loadDevices();
                          }}
                          onRestore={async () => {
                            await handleRestore();
                            await loadDevices();
                          }}
                          loading={recoveryLoading}
                          extra={
                            canVerifyWithOtherDevice ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={handleVerifyCurrentDevice}
                                disabled={actionLoading !== null}
                              >
                                <ShieldCheckIcon size={14} />
                                {t('settings.sessions.verifyWithAnotherDevice')}
                              </Button>
                            ) : undefined
                          }
                        />
                      ) : null}
                      {currentDevice.isVerified === true && qrLinkAvailable && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLinkingDevice(true)}
                        >
                          <QrCodeIcon size={14} />
                          {t('qrLogin.linkTitle')}
                        </Button>
                      )}
                    </>
                  }
                  extraMenuItems={[
                    {
                      label: t('settings.keyBackup.resetEncryptionKeys'),
                      icon: <ArrowClockwiseIcon size={16} />,
                      danger: true,
                      disabled: recoveryLoading,
                      onClick: async () => {
                        await handleRegenerate();
                        await loadDevices();
                      },
                    },
                    {
                      label: t('settings.account.logout'),
                      icon: <SignOutIcon size={16} />,
                      danger: true,
                      onClick: () => logout(),
                    },
                  ]}
                />
              ) : (
                <p className={css.emptyState}>{t('settings.sessions.noSessionsFound')}</p>
              )}
            </div>

            <div className={layoutCss.divider} />

            <div className={layoutCss.section}>
              <h3 className={layoutCss.sectionTitle}>{t('settings.sessions.yourDevices')}</h3>
              <p className={css.sessionNote}>{t('settings.sessions.devicesDescription')}</p>

              {uia.challenge && (
                <UiaPanel
                  challenge={uia.challenge}
                  onSubmitPassword={uia.handlePassword}
                  onSso={uia.handleSso}
                  onCancel={() => {
                    uia.handleCancel();
                    setActionLoading(null);
                  }}
                  submitting={uia.submitting}
                />
              )}

              {!uia.challenge && (
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
              ) : otherDevices.length === 0 ? (
                <p className={css.emptyState}>{t('settings.sessions.noSessionsFound')}</p>
              ) : (
                <div className={css.deviceList}>
                  {otherDevices.map((d) => (
                    <DeviceCard
                      key={d.deviceId}
                      device={d}
                      actionLoading={actionLoading}
                      onVerify={handleVerify}
                      onRemove={handleRemove}
                      onRename={handleRename}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className={layoutCss.divider} />

            <KeyBackupStatus
              client={client}
              busy={recoveryLoading}
              onEnterRecoveryKey={async () => {
                await handleRestore();
                await loadDevices();
              }}
            />

            <div className={layoutCss.divider} />

            <div className={layoutCss.section}>
              <ToggleRow
                label={t('settings.sessions.excludeInsecure')}
                description={t('settings.sessions.excludeInsecureNote')}
                checked={excludeInsecure}
                onChange={(value) => {
                  setExcludeInsecure(value);
                  if (client) applyDeviceIsolation(client, value);
                }}
              />
            </div>

            <div className={layoutCss.divider} />

            <RoomKeysBackup />
          </>
        );
      })()}
    </div>
  );
}
