import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientEvent } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { getErrorMessage } from '@/util/error';
import * as css from '../Settings.css';

const USER_ID_RE = /^@[^:\s]+:[^\s]+$/;

/** Everyone you have ignored (m.ignored_user_list), with a way to unignore or add by Matrix ID. */
export function IgnoredUsers() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const [ignored, setIgnored] = useState<string[]>(() => client?.getIgnoredUsers() ?? []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (client) setIgnored(client.getIgnoredUsers());
  }, [client]);
  useMatrixEvent(client, ClientEvent.AccountData, refresh);

  const update = async (next: string[]) => {
    if (!client) return;
    setBusy(true);
    try {
      await client.setIgnoredUsers(next);
      setIgnored(next);
    } catch (err) {
      toast.error(t('profile.ignoreFailed', { error: getErrorMessage(err) }));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const id = input.trim();
    if (!USER_ID_RE.test(id) || ignored.includes(id) || id === client?.getUserId()) return;
    await update([...ignored, id]);
    setInput('');
  };

  return (
    <div>
      <div className={css.settingRowColumn}>
        <span className={css.settingLabel}>{t('settings.privacy.ignoredUsers')}</span>
        <span className={css.settingNote}>{t('settings.privacy.ignoredUsersNote')}</span>
      </div>

      {ignored.length === 0 ? (
        <p className={css.settingNote}>{t('settings.privacy.ignoredUsersEmpty')}</p>
      ) : (
        ignored.map((userId) => (
          <div
            key={userId}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span className={css.settingLabel}>{userId}</span>
            <button
              type="button"
              className={css.actionBtnSecondary}
              disabled={busy}
              onClick={() => update(ignored.filter((u) => u !== userId))}
            >
              {t('profile.unignoreUser')}
            </button>
          </div>
        ))
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          className={css.inputFull}
          value={input}
          placeholder="@user:server"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <button
          type="button"
          className={css.actionBtn}
          disabled={busy || !USER_ID_RE.test(input.trim())}
          onClick={add}
        >
          {t('profile.ignoreUser')}
        </button>
      </div>
    </div>
  );
}
