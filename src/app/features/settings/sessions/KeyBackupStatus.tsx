import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadSimpleIcon, LockOpenIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Button } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { useRecoverySnapshot } from '@/app/features/keybackup/recoveryState';
import {
  restoreKeyBackupNow,
  useKeyBackupRestoreState,
} from '@/app/features/keybackup/keyBackupRestore';
import * as css from './Sessions.css';
import * as statusCss from './KeyBackupStatus.css';
import * as layoutCss from '../Settings.css';

interface KeyBackupStatusProps {
  client: MatrixClient | null;
  onEnterRecoveryKey: () => void | Promise<void>;
  busy?: boolean;
}

export function KeyBackupStatus({
  client,
  onEnterRecoveryKey,
  busy = false,
}: KeyBackupStatusProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const snapshot = useRecoverySnapshot(client);
  const restore = useKeyBackupRestoreState();

  const restoring = restore.phase === 'running';
  const canRestore = snapshot.backupActive && snapshot.backupKeyCached;
  const canUnlock = snapshot.backupExists && !canRestore && snapshot.secretStorageExists;

  const handleRestore = useCallback(async () => {
    if (!client) return;
    try {
      const result = await restoreKeyBackupNow(client);
      toast.success(
        t('settings.keyBackup.restoreSuccess', { imported: result.imported, total: result.total })
      );
    } catch (err) {
      toast.error(t('settings.keyBackup.restoreError', { error: getErrorMessage(err) }));
    }
  }, [client, t, toast]);

  let backupLabel: string;
  let backupTone: 'ok' | 'warn' | 'off' = 'warn';
  if (!snapshot.loaded) {
    backupLabel = t('common.loading');
    backupTone = 'off';
  } else if (!snapshot.backupExists) {
    backupLabel = t('settings.keyBackup.statusNoBackup');
    backupTone = 'off';
  } else if (canRestore) {
    backupLabel = t('settings.keyBackup.statusActive');
    backupTone = 'ok';
  } else if (snapshot.backupKeyCached && !snapshot.backupTrusted) {
    backupLabel = t('settings.keyBackup.statusNotTrusted');
  } else {
    backupLabel = t('settings.keyBackup.statusLocked');
  }

  const percent =
    restore.total > 0
      ? Math.min(100, Math.round(((restore.imported + restore.failed) / restore.total) * 100))
      : 0;

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>{t('settings.keyBackup.statusTitle')}</h3>
      <p className={css.sessionNote}>{t('settings.keyBackup.statusDescription')}</p>

      <dl className={statusCss.rows}>
        <div className={statusCss.row}>
          <dt className={statusCss.label}>{t('settings.keyBackup.statusBackup')}</dt>
          <dd className={statusCss.value} data-tone={backupTone}>
            {backupLabel}
          </dd>
        </div>
        <div className={statusCss.row}>
          <dt className={statusCss.label}>{t('settings.keyBackup.statusThisDevice')}</dt>
          <dd className={statusCss.value} data-tone={snapshot.deviceVerified ? 'ok' : 'warn'}>
            {snapshot.deviceVerified
              ? t('settings.keyBackup.statusDeviceVerified')
              : t('settings.keyBackup.statusDeviceUnverified')}
          </dd>
        </div>
        {snapshot.backupVersion && (
          <div className={statusCss.row}>
            <dt className={statusCss.label}>{t('settings.keyBackup.statusVersion')}</dt>
            <dd className={statusCss.value}>{snapshot.backupVersion}</dd>
          </div>
        )}
      </dl>

      {restoring && (
        <div className={statusCss.progressWrap} role="status">
          <div
            className={statusCss.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={restore.fetching ? undefined : percent}
          >
            <div
              className={statusCss.progressBar}
              data-indeterminate={restore.fetching || restore.total === 0 ? '' : undefined}
              style={restore.fetching || restore.total === 0 ? undefined : { width: `${percent}%` }}
            />
          </div>
          <span className={css.sessionNote}>
            {restore.fetching || restore.total === 0
              ? t('settings.keyBackup.restoreFetching')
              : t('settings.keyBackup.restoreProgress', {
                  imported: restore.imported,
                  total: restore.total,
                })}
          </span>
        </div>
      )}

      {restore.phase === 'done' && (
        <p className={css.sessionNote}>
          {t('settings.keyBackup.restoreSuccess', {
            imported: restore.imported,
            total: restore.total,
          })}
        </p>
      )}
      {restore.phase === 'error' && restore.error && (
        <p className={statusCss.error}>
          {t('settings.keyBackup.restoreError', { error: restore.error })}
        </p>
      )}

      <div className={statusCss.actions}>
        {canRestore && (
          <Button size="sm" onClick={handleRestore} disabled={restoring} loading={restoring}>
            <DownloadSimpleIcon size={14} />
            {t('settings.keyBackup.restoreFromBackup')}
          </Button>
        )}
        {canUnlock && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onEnterRecoveryKey}
            disabled={busy || restoring}
          >
            <LockOpenIcon size={14} />
            {t('settings.keyBackup.enterRecoveryKeyBtn')}
          </Button>
        )}
      </div>
    </div>
  );
}
