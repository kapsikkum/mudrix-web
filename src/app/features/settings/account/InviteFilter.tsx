import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { getErrorMessage } from '@/util/error';
import { ToggleRow } from '@/app/components/Toggle';
import * as css from '../Settings.css';

// Invite blocking (MSC4380), stable as m.invite_permission_config since spec v1.18.
// The unstable name is only used for servers that advertise nothing but the MSC flag.
const STABLE_TYPE = 'm.invite_permission_config';
const UNSTABLE_TYPE = 'org.matrix.msc4380.invite_permission_config';

type InviteType = typeof STABLE_TYPE | typeof UNSTABLE_TYPE;

interface Support {
  stable: boolean;
  unstable: boolean;
}

interface AccountDataClient {
  getAccountData(type: InviteType): { getContent(): unknown } | undefined;
  setAccountData(type: InviteType, content: object): Promise<unknown>;
}

function dataClient(client: MatrixClient): AccountDataClient {
  return client as unknown as AccountDataClient;
}

function isBlocking(client: MatrixClient, type: InviteType): boolean {
  const content = dataClient(client).getAccountData(type)?.getContent() as
    | { default_action?: unknown }
    | undefined;
  return content?.default_action === 'block';
}

async function detectSupport(client: MatrixClient): Promise<Support> {
  const [v118, stableFlag, unstableFlag] = await Promise.all([
    client.isVersionSupported('v1.18').catch(() => false),
    client.doesServerSupportUnstableFeature('org.matrix.msc4380.stable').catch(() => false),
    client.doesServerSupportUnstableFeature('org.matrix.msc4380').catch(() => false),
  ]);
  return { stable: v118 || stableFlag, unstable: unstableFlag };
}

export function InviteFilter() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const [support, setSupport] = useState<Support | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const readBlocked = useCallback(() => {
    if (!client) return;
    setBlocked(isBlocking(client, STABLE_TYPE) || isBlocking(client, UNSTABLE_TYPE));
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    readBlocked();
    detectSupport(client).then((s) => {
      if (!cancelled) setSupport(s);
    });
    return () => {
      cancelled = true;
    };
  }, [client, readBlocked]);

  useMatrixEvent(client, ClientEvent.AccountData, readBlocked);

  if (!client) return null;

  const supported = support ? support.stable || support.unstable : null;

  const handleChange = async (next: boolean) => {
    const s: Support = support ?? { stable: false, unstable: false };
    if (saving || (next && !s.stable && !s.unstable)) return;
    setSaving(true);
    try {
      const writes: Promise<unknown>[] = [];
      const store = dataClient(client);
      if (next) {
        const type = s.stable ? STABLE_TYPE : UNSTABLE_TYPE;
        writes.push(store.setAccountData(type, { default_action: 'block' }));
      } else {
        // Clear every slot that currently blocks so the setting really turns off.
        if (s.stable || isBlocking(client, STABLE_TYPE)) {
          writes.push(store.setAccountData(STABLE_TYPE, {}));
        }
        if (isBlocking(client, UNSTABLE_TYPE) || (!s.stable && s.unstable)) {
          writes.push(store.setAccountData(UNSTABLE_TYPE, {}));
        }
      }
      await Promise.all(writes);
      setBlocked(next);
    } catch (err) {
      toast.error(t('settings.account.inviteFilterFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ToggleRow
        label={t('settings.account.blockAllInvites')}
        description={
          supported === false
            ? t('settings.account.inviteFilterUnsupported')
            : t('settings.account.blockAllInvitesNote')
        }
        checked={blocked}
        onChange={handleChange}
        disabled={(!supported && !blocked) || saving}
      />
      <p className={css.settingNote}>{t('settings.account.inviteFilterIgnoreNote')}</p>
    </>
  );
}
