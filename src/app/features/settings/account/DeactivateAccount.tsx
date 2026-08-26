import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthType } from 'matrix-js-sdk/lib/interactive-auth';
import type { AuthDict, IAuthData } from 'matrix-js-sdk/lib/interactive-auth';
import { getMatrixClientOrNull, logout } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { useConfirm } from '@/app/hooks/useConfirm';
import { getErrorMessage } from '@/util/error';
import { Button } from '@/app/components/Button';
import { ToggleRow } from '@/app/components/Toggle/Toggle';
import { UiaPanel, offersPassword, offersSso } from '../sessions/UiaPanel';
import * as css from '../Settings.css';

export function DeactivateAccount() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const confirm = useConfirm();

  const [expanded, setExpanded] = useState(false);
  const [erase, setErase] = useState(false);
  const [challenge, setChallenge] = useState<IAuthData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!client) return null;

  const handleDeactivate = async () => {
    const ok = await confirm({
      title: t('settings.account.deactivateAccount'),
      message: t('settings.account.deactivateConfirm'),
      danger: true,
      confirmLabel: t('settings.account.deactivateAccount'),
    });
    if (!ok) return;

    setError('');
    setSubmitting(true);
    try {
      await client.deactivateAccount(undefined as unknown as AuthDict, erase);
      toast.success(t('settings.account.accountDeactivated'));
      await logout();
    } catch (err: unknown) {
      const mErr = err as { httpStatus?: number; data?: IAuthData };
      if (mErr?.httpStatus === 401 && mErr.data?.flows) {
        setChallenge(mErr.data);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUiaSubmit = async (pw: string) => {
    if (!challenge?.session) return;
    setSubmitting(true);
    try {
      const authDict = {
        type: AuthType.Password,
        identifier: { type: 'm.id.user' as const, user: client.getUserId() ?? '' },
        password: pw,
        session: challenge.session,
      };
      await client.deactivateAccount(authDict as never, erase);
      toast.success(t('settings.account.accountDeactivated'));
      await logout();
    } catch (err: unknown) {
      const mErr = err as { httpStatus?: number; data?: IAuthData };
      if (mErr?.httpStatus === 401 && mErr.data?.flows) {
        setChallenge(mErr.data);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (challenge) {
    const flows = challenge.flows;
    if (!offersPassword(flows) && !offersSso(flows)) {
      setError(t('settings.account.authMethodUnsupported'));
      setChallenge(null);
    }
    return (
      <UiaPanel
        challenge={{ authData: challenge, deviceId: '', displayName: '' }}
        onSubmitPassword={handleUiaSubmit}
        onSso={() => {}}
        onCancel={() => setChallenge(null)}
        submitting={submitting}
        description={t('settings.account.uiaPasswordDesc')}
        submitLabel={t('settings.account.deactivateAccount')}
      />
    );
  }

  if (!expanded) {
    return (
      <Button variant="danger" onClick={() => setExpanded(true)}>
        {t('settings.account.deactivateAccount')}
      </Button>
    );
  }

  return (
    <div className={css.fieldGroup}>
      <ToggleRow
        label={t('settings.account.eraseData')}
        checked={erase}
        onChange={setErase}
        disabled={submitting}
      />
      {error && <p className={css.warningBox}>{error}</p>}
      <div className={css.actions}>
        <Button variant="danger" loading={submitting} onClick={handleDeactivate}>
          {t('settings.account.deactivateAccount')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setExpanded(false);
            setErase(false);
            setError('');
          }}
        >
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
