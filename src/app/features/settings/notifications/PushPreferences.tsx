import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import {
  getPushStatus,
  isPushSupported,
  isTauriIos,
  registerPush,
  setPushKeepAlive,
  unregisterPush,
  type PushKeepAliveStrategy,
  type PushStatus,
} from '@/util/desktop';
import {
  getIosPushMode,
  getNtfyServer,
  getNtfyTopicUrl,
  isUnifiedPushEnabled,
  normalizeNtfyServer,
  setIosPushMode,
  setMatrixPusher,
  setNtfyMatrixPusher,
  setNtfyServer,
  setUnifiedPushEnabled,
  type IosPushMode,
} from '@/app/hooks/useUnifiedPush';
import { Select } from '@/app/components/Select';
import { showBrowserNotification } from '@/app/hooks/useNotifications';
import { getErrorMessage } from '@/util/error';
import type { TFunction } from 'i18next';
import * as layoutCss from '../Settings.css';

/** Background notifications: UnifiedPush on Android, keep-alive or ntfy on iOS. */
export function PushPreferences() {
  if (!isPushSupported()) return null;
  return isTauriIos() ? <IosPushPreferences /> : <AndroidPushPreferences />;
}

const BACKGROUND_TEST_MS = 10_000;
/** A timer that fires this much later than due means the page was paused in between. */
const PAUSED_AFTER_MS = 3000;

type BackgroundTest =
  | { state: 'idle' }
  | { state: 'waiting' }
  | { state: 'done'; lateMs: number; onScreen: boolean };

function backgroundTestNote(test: BackgroundTest, t: TFunction): string {
  if (test.state === 'idle') {
    return t('settings.notifications.push.testNote', {
      defaultValue:
        'Start the test, then lock your phone or switch to another app for at least 10 seconds. A notification should appear.',
    });
  }
  if (test.state === 'waiting') {
    return t('settings.notifications.push.testWaiting', {
      defaultValue: 'Now lock your phone or switch to another app for at least 10 seconds.',
    });
  }
  if (test.lateMs > PAUSED_AFTER_MS) {
    return t('settings.notifications.push.testPaused', {
      defaultValue:
        'iOS paused Mudrix while it was in the background (it woke {{seconds}} seconds late), so it could not show notifications. Stay connected is not keeping it running on this device.',
      seconds: Math.round(test.lateMs / 1000),
    });
  }
  if (test.onScreen) {
    return t('settings.notifications.push.testOnScreen', {
      defaultValue: 'Mudrix was still on screen. Leave the app before the 10 seconds are up.',
    });
  }
  return t('settings.notifications.push.testSent', {
    defaultValue:
      'Mudrix kept running in the background and sent a notification. If no banner appeared, check Settings > Notifications > Mudrix on your iPhone.',
  });
}

/** iOS: no APNs, so pick native keep-alive or the ntfy app. The modes are mutually exclusive. */
function IosPushPreferences() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [storedMode, setStoredMode] = useState<IosPushMode>(getIosPushMode());
  const [strategy, setStrategy] = useState<PushKeepAliveStrategy>('audio');
  const [serverInput, setServerInput] = useState(getNtfyServer());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [test, setTest] = useState<BackgroundTest>({ state: 'idle' });
  const testTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (testTimer.current !== null) window.clearTimeout(testTimer.current);
    },
    []
  );

  // Sends a notification from the page after a delay, and notes whether the page was running on time
  // and whether the app was on screen: together they say if iOS keeps the page alive in the background.
  const startTest = () => {
    const due = Date.now() + BACKGROUND_TEST_MS;
    setTest({ state: 'waiting' });
    testTimer.current = window.setTimeout(() => {
      const lateMs = Date.now() - due;
      const onScreen = document.visibilityState === 'visible';
      setTest({ state: 'done', lateMs, onScreen });
      showBrowserNotification(
        t('settings.notifications.push.testTitle', { defaultValue: 'Mudrix test' }),
        t('settings.notifications.push.testBody', {
          defaultValue: 'Background notifications work.',
        })
      ).catch(() => {});
    }, BACKGROUND_TEST_MS);
  };

  const refresh = useCallback(async () => {
    const next = await getPushStatus();
    setStatus(next);
    if (next?.keepAliveStrategy) setStrategy(next.keepAliveStrategy);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!status) return null;

  // The native side persists keep-alive, so it is the source of truth for that mode.
  const mode: IosPushMode = status.keepAlive ? 'keepalive' : storedMode === 'ntfy' ? 'ntfy' : 'off';
  const topicUrl = getNtfyTopicUrl();

  const selectMode = async (next: IosPushMode) => {
    if (next === mode || busy) return;
    const client = getMatrixClientOrNull();
    if ((next === 'ntfy' || mode === 'ntfy') && !client) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'ntfy' && client) await setMatrixPusher(client, null);
      if (mode === 'keepalive') await setPushKeepAlive(false);
      if (next === 'keepalive') await setPushKeepAlive(true, strategy);
      if (next === 'ntfy' && client) await setNtfyMatrixPusher(client);
      setIosPushMode(next);
      setStoredMode(next);
      await refresh();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const selectStrategy = async (next: PushKeepAliveStrategy) => {
    if (next === strategy || busy) return;
    setStrategy(next);
    if (mode !== 'keepalive') return;
    setBusy(true);
    setMessage(null);
    try {
      await setPushKeepAlive(true, next);
      await refresh();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const applyServer = async () => {
    const server = normalizeNtfyServer(serverInput);
    if (!server) {
      setMessage(
        t('settings.notifications.push.ntfyServerInvalid', {
          defaultValue: 'Enter a full server address, for example https://ntfy.sh.',
        })
      );
      return;
    }
    setServerInput(server);
    if (server === getNtfyServer()) return;
    setBusy(true);
    setMessage(null);
    try {
      const client = getMatrixClientOrNull();
      // Remove the pusher registered against the old server before pointing at the new one.
      if (mode === 'ntfy' && client) await setMatrixPusher(client, null);
      setNtfyServer(server);
      if (mode === 'ntfy' && client) await setNtfyMatrixPusher(client, server);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copyTopic = async () => {
    try {
      await navigator.clipboard.writeText(topicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; the URL is still selectable
    }
  };

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>
        {t('settings.notifications.push.title', { defaultValue: 'Background notifications' })}
      </h3>
      <p className={layoutCss.settingNote}>
        {t('settings.notifications.push.iosNote', {
          defaultValue:
            'iOS only delivers push through Apple, which Mudrix cannot use. Pick one way to hear about messages while the app is closed.',
        })}
      </p>
      <div className={layoutCss.settingRow}>
        <span className={layoutCss.settingLabel}>
          {t('settings.notifications.push.mode', { defaultValue: 'How to get notifications' })}
        </span>
        <Select<IosPushMode>
          aria-label={t('settings.notifications.push.mode', {
            defaultValue: 'How to get notifications',
          })}
          value={mode}
          disabled={busy}
          options={[
            {
              value: 'off',
              label: t('settings.notifications.push.modeOff', { defaultValue: 'Off' }),
            },
            {
              value: 'keepalive',
              label: t('settings.notifications.push.modeKeepAlive', {
                defaultValue: 'Stay connected',
              }),
            },
            {
              value: 'ntfy',
              label: t('settings.notifications.push.modeNtfy', { defaultValue: 'ntfy' }),
            },
          ]}
          onChange={selectMode}
        />
      </div>
      {mode !== 'off' && !status.notificationsAllowed && (
        <p className={layoutCss.settingNote}>
          {t('settings.notifications.push.needsPermission', {
            defaultValue:
              'Notifications are not allowed for Mudrix. Turn them on in the iOS Settings app first.',
          })}
        </p>
      )}

      {mode === 'keepalive' && (
        <>
          <p className={layoutCss.settingNote}>
            {t('settings.notifications.push.keepAliveIosNote', {
              defaultValue:
                'Mudrix keeps running in the background so messages arrive normally. This uses extra battery, and iOS may still suspend the app, for example when memory is low or after a restart.',
            })}
          </p>
          <div className={layoutCss.settingRow}>
            <span className={layoutCss.settingLabel}>
              {t('settings.notifications.push.strategy', { defaultValue: 'Method' })}
            </span>
            <Select<PushKeepAliveStrategy>
              aria-label={t('settings.notifications.push.strategy', { defaultValue: 'Method' })}
              value={strategy}
              disabled={busy}
              options={[
                {
                  value: 'audio',
                  label: t('settings.notifications.push.strategyAudio', {
                    defaultValue: 'Silent audio (default)',
                  }),
                },
                {
                  value: 'location',
                  label: t('settings.notifications.push.strategyLocation', {
                    defaultValue: 'Background location',
                  }),
                },
              ]}
              onChange={selectStrategy}
            />
          </div>
          <div className={layoutCss.settingRow}>
            <div className={layoutCss.settingInfo}>
              <span className={layoutCss.settingLabel}>
                {t('settings.notifications.push.test', {
                  defaultValue: 'Test background notifications',
                })}
              </span>
              <span className={layoutCss.settingNote}>{backgroundTestNote(test, t)}</span>
            </div>
            <button
              type="button"
              className={layoutCss.actionBtnSecondary}
              disabled={test.state === 'waiting'}
              onClick={startTest}
            >
              {t('settings.notifications.push.testStart', { defaultValue: 'Start test' })}
            </button>
          </div>
          <p className={layoutCss.settingNote}>
            {strategy === 'audio'
              ? t('settings.notifications.push.strategyAudioNote', {
                  defaultValue:
                    'Plays inaudible audio. It interrupts nothing, but other audio apps may behave oddly.',
                })
              : t('settings.notifications.push.strategyLocationNote', {
                  defaultValue:
                    'Uses a low-accuracy location session. Your location is never read or sent, but iOS shows the location indicator.',
                })}
          </p>
        </>
      )}

      {mode === 'ntfy' && (
        <>
          <label className={layoutCss.fieldLabel} htmlFor="ntfy-server">
            {t('settings.notifications.push.ntfyServer', { defaultValue: 'ntfy server' })}
          </label>
          <input
            id="ntfy-server"
            className={layoutCss.inputFull}
            value={serverInput}
            disabled={busy}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            onChange={(e) => setServerInput(e.target.value)}
            onBlur={applyServer}
          />
          <label className={layoutCss.fieldLabel} htmlFor="ntfy-topic">
            {t('settings.notifications.push.ntfyTopic', { defaultValue: 'Your topic' })}
          </label>
          <input
            id="ntfy-topic"
            className={layoutCss.inputFull}
            value={topicUrl}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className={layoutCss.actionBtnSecondary} onClick={copyTopic}>
            {copied
              ? t('settings.notifications.push.copied', { defaultValue: 'Copied' })
              : t('settings.notifications.push.copyTopic', { defaultValue: 'Copy topic URL' })}
          </button>
          <p className={layoutCss.settingNote}>
            {t('settings.notifications.push.ntfySteps', {
              defaultValue:
                '1. Install ntfy from the App Store. 2. In ntfy, subscribe to the topic above (on a self-hosted server, use that server). 3. Allow notifications for ntfy.',
            })}
          </p>
          <p className={layoutCss.settingNote}>
            {t('settings.notifications.push.ntfyGeneric', {
              defaultValue:
                'Notifications from ntfy are generic ("New message") and tapping one opens ntfy, not Mudrix. Anyone who knows the topic can see these alerts, so keep it private.',
            })}
          </p>
        </>
      )}
      {message && <p className={layoutCss.settingNote}>{message}</p>}
    </div>
  );
}

/** Android only: background notifications through a UnifiedPush distributor (e.g. ntfy). */
function AndroidPushPreferences() {
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
