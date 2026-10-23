import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import {
  getPushStatus,
  isPushSupported,
  registerPush,
  setPushKeepAlive,
  unregisterPush,
  type PushStatus,
} from '@/util/desktop';
import {
  isUnifiedPushEnabled,
  setMatrixPusher,
  setUnifiedPushEnabled,
} from '@/app/hooks/useUnifiedPush';
import { getErrorMessage } from '@/util/error';
import * as layoutCss from '../Settings.css';

/** Android only: background notifications through a UnifiedPush distributor (e.g. ntfy). */
export function PushPreferences() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [enabled, setEnabled] = useState(isUnifiedPushEnabled());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => setStatus(await getPushStatus()), []);

  useEffect(() => {
    refresh();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [refresh]);

  if (!isPushSupported() || !status) return null;

  const enable = async (distributor?: string) => {
    const client = getMatrixClientOrNull();
    if (!client) return;
    setBusy(true);
    setMessage(null);
    try {
      await registerPush(distributor);
      setUnifiedPushEnabled(true);
      setEnabled(true);
      // The distributor answers asynchronously with the endpoint.
      let tries = 0;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        tries += 1;
        const next = await getPushStatus();
        if (next) setStatus(next);
        if (next?.endpoint) {
          window.clearInterval(pollRef.current!);
          try {
            await setMatrixPusher(client, next.endpoint);
            setMessage(
              t('settings.notifications.push.ready', {
                defaultValue: 'Background notifications are on.',
              })
            );
          } catch (err) {
            setMessage(getErrorMessage(err));
          }
          setBusy(false);
        } else if (next?.error || tries > 20) {
          window.clearInterval(pollRef.current!);
          setMessage(
            next?.error ??
              t('settings.notifications.push.timeout', {
                defaultValue: 'The distributor did not answer. Is it running?',
              })
          );
          setBusy(false);
        }
      }, 1000);
    } catch (err) {
      setMessage(getErrorMessage(err));
      setBusy(false);
    }
  };

  const disable = async () => {
    const client = getMatrixClientOrNull();
    setBusy(true);
    try {
      if (client) await setMatrixPusher(client, null);
      await unregisterPush();
      setUnifiedPushEnabled(false);
      setEnabled(false);
      await refresh();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleKeepAlive = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await setPushKeepAlive(!status.keepAlive);
      await refresh();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>
        {t('settings.notifications.push.title', { defaultValue: 'Background notifications' })}
      </h3>
      <p className={layoutCss.settingNote}>
        {t('settings.notifications.push.note', {
          defaultValue:
            'Receive notifications while Mudrix is closed through a UnifiedPush app such as ntfy. No Google account needed.',
        })}
      </p>
      {status.distributors.length === 0 ? (
        <p className={layoutCss.settingNote}>
          {t('settings.notifications.push.noDistributor', {
            defaultValue: 'Install a UnifiedPush distributor (for example ntfy) first.',
          })}
        </p>
      ) : enabled && status.endpoint ? (
        <button
          type="button"
          className={layoutCss.actionBtnSecondary}
          disabled={busy}
          onClick={disable}
        >
          {t('settings.notifications.push.disable', { defaultValue: 'Turn off' })}
        </button>
      ) : (
        status.distributors.map((distributor) => (
          <button
            key={distributor}
            type="button"
            className={layoutCss.actionBtn}
            disabled={busy}
            onClick={() => enable(distributor)}
          >
            {t('settings.notifications.push.enableWith', {
              defaultValue: 'Enable with {{name}}',
              name: distributor,
            })}
          </button>
        ))
      )}
      <p className={layoutCss.settingNote}>
        {t('settings.notifications.push.keepAliveNote', {
          defaultValue:
            'No distributor? Stay connected in the background instead. Shows a quiet notification and uses more battery.',
        })}
      </p>
      <button
        type="button"
        className={status.keepAlive ? layoutCss.actionBtnSecondary : layoutCss.actionBtn}
        disabled={busy}
        onClick={toggleKeepAlive}
      >
        {status.keepAlive
          ? t('settings.notifications.push.keepAliveOff', {
              defaultValue: 'Stop staying connected',
            })
          : t('settings.notifications.push.keepAliveOn', {
              defaultValue: 'Stay connected in the background',
            })}
      </button>
      {message && <p className={layoutCss.settingNote}>{message}</p>}
    </div>
  );
}
