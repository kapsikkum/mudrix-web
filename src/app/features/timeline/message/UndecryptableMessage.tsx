import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  ArrowClockwiseIcon,
  ArrowUpIcon,
  CaretDownIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  LockIcon,
  LockOpenIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { Button } from '@/app/components/Button';
import { settingsOpenAtom, settingsPageAtom } from '@/app/store/atoms';
import { useRecoveryKeyActions } from '@/app/features/settings/sessions/useRecoveryKeyActions';
import { useRecoverySnapshot } from '@/app/features/keybackup/recoveryState';
import {
  restoreKeyBackupNow,
  retryDecryption,
  useKeyBackupRestoreState,
} from '@/app/features/keybackup/keyBackupRestore';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import {
  FOLDED_UNDECRYPTABLE_ATTR,
  UNDECRYPTABLE_RUN_THRESHOLD,
  expandedUndecryptableRoomsAtom,
  getUndecryptableCause,
  getUndecryptableRun,
  useDecryptionTick,
} from './undecryptable';
import type { UndecryptableCause } from './undecryptable';
import * as css from './UndecryptableMessage.css';

function helpKeyFor(cause: UndecryptableCause): string | null {
  switch (cause) {
    case 'historicalNotJoined':
      return 'notJoined';
    case 'withheld':
      return 'withheld';
    case 'unsignedSender':
    case 'unknownSender':
    case 'senderPreviouslyVerified':
      return 'senderUntrusted';
    default:
      return null;
  }
}

interface HelpProps {
  client: MatrixClient;
  events: readonly MatrixEvent[];
  cause: UndecryptableCause;
  /** Extra buttons shown after the recovery actions. */
  children?: ReactNode;
}

/** Contextual explanation and recovery actions. Only mounted while the help is open. */
function UndecryptableHelp({ client, events, cause, children }: HelpProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const snapshot = useRecoverySnapshot(client);
  const { handleRestore, loading: unlocking } = useRecoveryKeyActions(client);
  const restore = useKeyBackupRestoreState();
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const [retrying, setRetrying] = useState(false);

  const openSessions = useCallback(() => {
    setSettingsPage('sessions');
    setSettingsOpen(true);
  }, [setSettingsOpen, setSettingsPage]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await retryDecryption(client, events);
    } finally {
      setRetrying(false);
    }
  }, [client, events]);

  const handleRestoreFromBackup = useCallback(async () => {
    try {
      const result = await restoreKeyBackupNow(client);
      toast.success(
        t('settings.keyBackup.restoreSuccess', { imported: result.imported, total: result.total })
      );
    } catch (err) {
      toast.error(t('timeline.undecryptable.restoreFailed', { error: getErrorMessage(err) }));
    }
  }, [client, t, toast]);

  const restoring = restore.phase === 'running';
  const fixedKey = helpKeyFor(cause);

  let helpKey: string;
  let canEnterKey = false;
  let canVerify = false;
  let canRestore = false;
  if (fixedKey) {
    helpKey = fixedKey;
  } else if (!snapshot.loaded) {
    helpKey = 'generic';
  } else if (snapshot.backupActive && snapshot.backupKeyCached) {
    helpKey = snapshot.deviceVerified ? 'backupReady' : 'backupReadyUnverified';
    canRestore = true;
    canVerify = !snapshot.deviceVerified;
  } else if (snapshot.backupExists || snapshot.secretStorageExists) {
    helpKey = snapshot.deviceVerified ? 'backupLocked' : 'unverified';
    canEnterKey = snapshot.secretStorageExists;
    canVerify = !snapshot.deviceVerified;
  } else {
    helpKey = 'noBackup';
    canVerify = true;
  }

  return (
    <div className={css.help}>
      <p className={css.helpText}>{t(`timeline.undecryptable.help.${helpKey}`)}</p>

      {restoring && (
        <p className={css.progress} role="status">
          {restore.fetching || restore.total === 0
            ? t('timeline.undecryptable.restoreFetching')
            : t('timeline.undecryptable.restoreProgress', {
                imported: restore.imported,
                total: restore.total,
              })}
        </p>
      )}

      <div className={css.helpActions}>
        {canEnterKey && (
          <Button variant="primary" size="sm" onClick={handleRestore} disabled={unlocking}>
            <LockOpenIcon size={14} />
            {t('settings.keyBackup.enterRecoveryKeyBtn')}
          </Button>
        )}
        {canVerify && (
          <Button variant="secondary" size="sm" onClick={openSessions}>
            <ShieldCheckIcon size={14} />
            {t('timeline.undecryptable.verifySession')}
          </Button>
        )}
        {canRestore && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleRestoreFromBackup}
            disabled={restoring}
          >
            <DownloadSimpleIcon size={14} />
            {t('timeline.undecryptable.restoreBackup')}
          </Button>
        )}
        {helpKey === 'noBackup' && (
          <Button variant="secondary" size="sm" onClick={openSessions}>
            {t('timeline.undecryptable.importKeys')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleRetry} disabled={retrying || restoring}>
          <ArrowClockwiseIcon size={14} className={retrying ? 'icon-spin' : undefined} />
          {t('timeline.undecryptable.retry')}
        </Button>
        {children}
      </div>
    </div>
  );
}

interface UndecryptableHistoryNoticeProps {
  client: MatrixClient;
  /** The loaded events of the room; the undecryptable ones are retried by "Try again". */
  events: readonly MatrixEvent[];
  loading: boolean;
  onLoadOlder: () => void;
}

/**
 * Shown at the top of the timeline once loading older history stopped because it was all
 * messages this device can't decrypt. Says why, once, with the same recovery actions as the
 * placeholders, instead of fetching page after page of messages nobody can read here.
 */
export function UndecryptableHistoryNotice({
  client,
  events,
  loading,
  onLoadOlder,
}: UndecryptableHistoryNoticeProps) {
  const { t } = useTranslation();
  const undecryptable = useMemo(() => events.filter((e) => e.isDecryptionFailure()), [events]);
  const cause = undecryptable.length > 0 ? getUndecryptableCause(undecryptable[0]) : 'unknown';

  return (
    <div className={css.historyNotice} role="status" data-undecryptable-notice="">
      <span className={css.historyNoticeTitle}>
        <LockIcon size={14} />
        {t('timeline.undecryptable.historyPaused')}
      </span>
      <div className={css.reason}>{t('timeline.undecryptable.historyPausedReason')}</div>
      <UndecryptableHelp client={client} events={undecryptable} cause={cause}>
        <Button variant="ghost" size="sm" onClick={onLoadOlder} disabled={loading}>
          <ArrowUpIcon size={14} />
          {t('timeline.undecryptable.loadOlder')}
        </Button>
      </UndecryptableHelp>
    </div>
  );
}

interface UndecryptableMessageProps {
  event: MatrixEvent;
  client: MatrixClient;
}

/**
 * Placeholder for a message this device could not decrypt. Explains why, offers the actions that
 * can actually help, and folds long runs of such messages into a single row.
 */
export function UndecryptableMessage({ event, client }: UndecryptableMessageProps) {
  const { t } = useTranslation();
  const tick = useDecryptionTick(client);
  const roomId = event.getRoomId() ?? '';
  const [expandedRooms, setExpandedRooms] = useAtom(expandedUndecryptableRoomsAtom);
  const [helpOpen, setHelpOpen] = useState(false);

  // `tick` changes when messages nearby decrypt, so runs split and counts update live.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useMemo(() => getUndecryptableRun(client, event), [client, event, tick]);

  const roomExpanded = expandedRooms.has(roomId);
  const inRun = run !== null && run.count >= UNDECRYPTABLE_RUN_THRESHOLD;
  const folded = inRun && !roomExpanded;

  const setRoomExpanded = useCallback(
    (expand: boolean) => {
      setExpandedRooms((prev) => {
        const next = new Set(prev);
        if (expand) next.add(roomId);
        else next.delete(roomId);
        return next;
      });
    },
    [roomId, setExpandedRooms]
  );

  if (folded && !run.isFirst) {
    return <span {...{ [FOLDED_UNDECRYPTABLE_ATTR]: '' }} className={css.foldedMarker} />;
  }

  const cause = getUndecryptableCause(event);
  const retryEvents = folded ? run.events : [event];

  return (
    <div className={css.root}>
      <div className={css.header}>
        <span className={css.title}>
          <LockIcon size={14} />
          {folded
            ? t('timeline.undecryptable.group', { count: run.count })
            : t('timeline.couldNotDecrypt')}
        </span>
        <span className={css.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((open) => !open)}
          >
            {helpOpen ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />}
            {t('timeline.undecryptable.howToFix')}
          </Button>
          {folded && (
            <Button variant="ghost" size="sm" onClick={() => setRoomExpanded(true)}>
              {t('timeline.undecryptable.showAll')}
            </Button>
          )}
          {inRun && roomExpanded && run.isFirst && (
            <Button variant="ghost" size="sm" onClick={() => setRoomExpanded(false)}>
              {t('timeline.undecryptable.collapse')}
            </Button>
          )}
        </span>
      </div>
      <div className={css.reason}>{t(`timeline.undecryptable.reason.${cause}`)}</div>
      {helpOpen && <UndecryptableHelp client={client} events={retryEvents} cause={cause} />}
    </div>
  );
}
