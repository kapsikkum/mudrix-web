import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import { ClientEvent, type MatrixClient } from 'matrix-js-sdk';
import { syncStateAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useConfirm } from '@/app/hooks/useConfirm';
import { useToast } from '@/app/hooks/useToast';
import { CopyButton } from '@/app/components/Button';
import { clearMediaCache } from '@/app/features/timeline/message/mediaCache';
import { getActiveSlidingSync } from '@/client/slidingSync';
import { CURRENT_VERSION } from '@/util/versionCheck';
import * as css from '../Settings.css';

/** Account data that holds (encrypted) secrets; never listed or copied from here. */
const HIDDEN_ACCOUNT_DATA = /^(m\.cross_signing\.|m\.megolm_backup|m\.secret_storage|m\.secret)/;

interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function InfoRow({ label, value, mono = true }: InfoRowProps) {
  return (
    <div className={css.tokenRow}>
      <span className={css.settingLabel} style={{ minWidth: 150 }}>
        {label}
      </span>
      {mono ? <code className={css.tokenField}>{value}</code> : <span>{value}</span>}
      <CopyButton text={value} />
    </div>
  );
}

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
}

function Collapsible({ title, children }: CollapsibleProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className={css.accessTokenBtn} onClick={() => setOpen(!open)}>
        {open ? <CaretDownIcon size={14} /> : <CaretRightIcon size={14} />}
        {title}
      </button>
      {open && <div className={css.tokenSection}>{children}</div>}
    </div>
  );
}

interface CryptoInfo {
  crossSigning: boolean;
  secretStorage: boolean;
  backupVersion: string | null;
  ed25519: string;
  curve25519: string;
}

function useCryptoInfo(client: MatrixClient): CryptoInfo | null {
  const [info, setInfo] = useState<CryptoInfo | null>(null);
  useEffect(() => {
    const crypto = client.getCrypto();
    if (!crypto) return undefined;
    let cancelled = false;
    Promise.all([
      crypto.isCrossSigningReady(),
      crypto.isSecretStorageReady(),
      crypto.getActiveSessionBackupVersion(),
      crypto.getOwnDeviceKeys(),
    ])
      .then(([crossSigning, secretStorage, backupVersion, keys]) => {
        if (cancelled) return;
        setInfo({
          crossSigning,
          secretStorage,
          backupVersion,
          ed25519: keys.ed25519,
          curve25519: keys.curve25519,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);
  return info;
}

function useServerInfo(client: MatrixClient) {
  const [info, setInfo] = useState<{
    versions: string[];
    features: Record<string, boolean>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    client
      .getVersions()
      .then((v) => {
        if (!cancelled) setInfo({ versions: v.versions, features: v.unstable_features ?? {} });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);
  return info;
}

function AccountDataViewer({ client }: { client: MatrixClient }) {
  const { t } = useTranslation();
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useMatrixEvent(client, ClientEvent.AccountData, () => setRevision((n) => n + 1));

  // `revision` only exists to re-read the store when account data changes.
  void revision;
  const types = Object.keys(
    (client.store as unknown as { accountData?: Record<string, unknown> }).accountData ?? {}
  )
    .filter((type) => !HIDDEN_ACCOUNT_DATA.test(type))
    .sort();
  const content = selected
    ? JSON.stringify(client.getAccountData(selected as never)?.getContent() ?? null, null, 2)
    : '';

  return (
    <>
      <span className={css.settingNote}>
        {t('settings.developer.accountDataNote', { count: types.length })}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className={type === selected ? css.actionBtn : css.actionBtnSecondary}
            onClick={() => setSelected(type === selected ? null : type)}
          >
            {type}
          </button>
        ))}
      </div>
      {selected && (
        <div>
          <div className={css.tokenRow}>
            <code className={css.tokenField} style={{ whiteSpace: 'pre', overflow: 'auto' }}>
              {content}
            </code>
            <CopyButton text={content} />
          </div>
        </div>
      )}
    </>
  );
}

/** Diagnostics and maintenance tools, shown only while developer mode is on. */
export function DeveloperTools({ client }: { client: MatrixClient }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const syncState = useAtomValue(syncStateAtom);
  const crypto = useCryptoInfo(client);
  const server = useServerInfo(client);

  const userId = client.getUserId() ?? '';
  const deviceId = client.getDeviceId() ?? '';
  const rooms = client.getRooms();
  const joined = rooms.filter((r) => r.getMyMembership() === 'join').length;
  const invited = rooms.filter((r) => r.getMyMembership() === 'invite').length;
  const sliding = getActiveSlidingSync() !== null;
  const featureList = server ? Object.entries(server.features) : [];
  const yes = t('settings.developer.ready');
  const no = t('settings.developer.notReady');

  const debugInfo = () =>
    JSON.stringify(
      {
        app: CURRENT_VERSION,
        userAgent: navigator.userAgent,
        userId,
        deviceId,
        homeserver: client.getHomeserverUrl(),
        syncMode: sliding ? 'sliding' : 'classic',
        syncState,
        rooms: { joined, invited },
        crypto,
        serverVersions: server?.versions,
        serverFeatures: server?.features,
      },
      null,
      2
    );

  const copyDebug = () => {
    navigator.clipboard
      .writeText(debugInfo())
      .then(() => toast.success(t('common.copied')))
      .catch(() => toast.error(t('common.copyFailed')));
  };

  const clearMedia = async () => {
    await clearMediaCache();
    toast.success(t('settings.developer.clearMediaDone'));
  };

  const resetSyncCache = async () => {
    const ok = await confirm({
      title: t('settings.developer.resetSyncCache'),
      message: t('settings.developer.resetSyncCacheConfirm'),
      danger: true,
      confirmLabel: t('settings.developer.resetSyncCacheAction'),
    });
    if (!ok) return;
    client.stopClient();
    await new Promise<void>((resolve) => {
      // Only the sync store; the crypto databases are left alone so no keys are lost.
      const req = indexedDB.deleteDatabase(`matrix-store-${userId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    window.location.reload();
  };

  return (
    <>
      <div className={css.divider} />
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.developer.session')}</h3>
        <InfoRow label={t('settings.developer.userId')} value={userId} />
        <InfoRow label={t('settings.developer.deviceId')} value={deviceId} />
        <InfoRow label={t('settings.developer.appVersion')} value={CURRENT_VERSION} />
        <InfoRow
          label={t('settings.developer.syncMode')}
          value={
            sliding ? t('settings.developer.syncSliding') : t('settings.developer.syncClassic')
          }
          mono={false}
        />
        <InfoRow label={t('settings.developer.syncState')} value={syncState ?? '-'} />
        <InfoRow
          label={t('settings.developer.rooms')}
          value={t('settings.developer.roomsValue', { joined, invited })}
          mono={false}
        />
        {server && (
          <InfoRow
            label={t('settings.developer.specVersion')}
            value={server.versions[server.versions.length - 1] ?? '-'}
          />
        )}
      </div>

      <div className={css.divider} />
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.developer.encryption')}</h3>
        {crypto ? (
          <>
            <InfoRow
              label={t('settings.developer.crossSigning')}
              value={crypto.crossSigning ? yes : no}
              mono={false}
            />
            <InfoRow
              label={t('settings.developer.secretStorage')}
              value={crypto.secretStorage ? yes : no}
              mono={false}
            />
            <InfoRow
              label={t('settings.developer.keyBackup')}
              value={crypto.backupVersion ?? no}
              mono={false}
            />
            <InfoRow label="Ed25519" value={crypto.ed25519} />
            <InfoRow label="Curve25519" value={crypto.curve25519} />
          </>
        ) : (
          <span className={css.settingNote}>{t('settings.developer.cryptoUnavailable')}</span>
        )}
      </div>

      <div className={css.divider} />
      <div className={css.section}>
        <Collapsible title={t('settings.developer.serverFeatures', { count: featureList.length })}>
          <div className={css.tokenRow}>
            <code className={css.tokenField} style={{ whiteSpace: 'pre', overflow: 'auto' }}>
              {featureList.map(([name, on]) => `${on ? '+' : '-'} ${name}`).join('\n')}
            </code>
            <CopyButton text={featureList.map(([name]) => name).join('\n')} />
          </div>
        </Collapsible>
        <Collapsible title={t('settings.developer.accountData')}>
          <AccountDataViewer client={client} />
        </Collapsible>
      </div>

      <div className={css.divider} />
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.developer.tools')}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className={css.actionBtnSecondary} onClick={copyDebug}>
            {t('settings.developer.copyDebugInfo')}
          </button>
          <button type="button" className={css.actionBtnSecondary} onClick={clearMedia}>
            {t('settings.developer.clearMedia')}
          </button>
          <button type="button" className={css.actionBtnSecondary} onClick={resetSyncCache}>
            {t('settings.developer.resetSyncCache')}
          </button>
        </div>
        <span className={css.settingNote}>{t('settings.developer.resetSyncCacheNote')}</span>
      </div>
    </>
  );
}
