import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { AuthType } from 'matrix-js-sdk/lib/interactive-auth';
import type { IAuthData } from 'matrix-js-sdk/lib/interactive-auth';
import { waitForSsoFallback } from '@/app/features/sso/sso';
import { useSsoBrowserDone } from '@/app/hooks/useSsoBrowserDone';
import { getErrorMessage } from '@/util/error';
import { useToast } from '@/app/hooks/useToast';
import { offersPassword, offersSso, type UiaChallenge } from './sessions/UiaPanel';

export type UiaActionFn = (auth?: Record<string, unknown>) => Promise<unknown>;

export interface UiaActionContext {
  deviceId?: string;
  displayName?: string;
}

export interface UseUiaActionOptions {
  client: MatrixClient | null | undefined;
  onSuccess?: (context: UiaActionContext) => void;
  onError?: (error: unknown) => void;
}

export function useUiaAction(options: UseUiaActionOptions) {
  const { client, onSuccess, onError } = options;
  const { t } = useTranslation();
  const toast = useToast();
  const confirmSsoDone = useSsoBrowserDone();
  const [challenge, setChallenge] = useState<UiaChallenge | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeActionRef = useRef<UiaActionFn | null>(null);
  const activeContextRef = useRef<UiaActionContext>({});

  const execute = useCallback(
    async (action: UiaActionFn, context: UiaActionContext = {}): Promise<boolean> => {
      if (!client) return false;
      setError(null);
      setSubmitting(true);
      activeActionRef.current = action;
      activeContextRef.current = context;

      try {
        const result = await action();
        if (result && typeof result === 'object' && 'flows' in result) {
          const authData = result as IAuthData;
          if (!offersPassword(authData.flows) && !offersSso(authData.flows)) {
            const msg = t('settings.account.authMethodUnsupported');
            setError(msg);
            setChallenge(null);
            onError?.(new Error(msg));
            return false;
          }
          setChallenge({
            authData,
            deviceId: context.deviceId ?? '',
            displayName: context.displayName ?? '',
          });
          return false;
        }
        const ctx = activeContextRef.current;
        setChallenge(null);
        activeActionRef.current = null;
        activeContextRef.current = {};
        onSuccess?.(ctx);
        return true;
      } catch (err: unknown) {
        const mErr = err as { httpStatus?: number; data?: IAuthData };
        if (mErr?.httpStatus === 401 && mErr.data?.flows) {
          const authData = mErr.data;
          if (!offersPassword(authData.flows) && !offersSso(authData.flows)) {
            const msg = t('settings.account.authMethodUnsupported');
            setError(msg);
            setChallenge(null);
            onError?.(new Error(msg));
            return false;
          }
          setChallenge({
            authData,
            deviceId: context.deviceId ?? '',
            displayName: context.displayName ?? '',
          });
          return false;
        }
        const msg = getErrorMessage(err);
        setError(msg);
        onError?.(err);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [client, onSuccess, onError, t]
  );

  const handlePassword = useCallback(
    async (password: string) => {
      if (!client || !challenge?.authData?.session || !activeActionRef.current) return;
      setSubmitting(true);
      setError(null);
      try {
        const authDict = {
          type: AuthType.Password,
          identifier: { type: 'm.id.user' as const, user: client.getUserId() ?? '' },
          password,
          session: challenge.authData.session,
        };
        const result = await activeActionRef.current(authDict);
        if (result && typeof result === 'object' && 'flows' in result) {
          setChallenge({
            ...challenge,
            authData: result as IAuthData,
          });
          throw new Error('Additional auth stages required');
        }
        const ctx = activeContextRef.current;
        setChallenge(null);
        activeActionRef.current = null;
        activeContextRef.current = {};
        onSuccess?.(ctx);
      } catch (err: unknown) {
        const mErr = err as { httpStatus?: number; data?: IAuthData };
        if (mErr?.httpStatus === 401 && mErr.data?.flows) {
          setChallenge({
            ...challenge,
            authData: mErr.data,
          });
        } else if (!(err instanceof Error && err.message === 'Additional auth stages required')) {
          const msg = getErrorMessage(err);
          setError(msg);
          onError?.(err);
        }
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [client, challenge, onSuccess, onError]
  );

  const handleSso = useCallback(async () => {
    if (!client || !challenge?.authData?.session || !activeActionRef.current) return;
    const session = challenge.authData.session;
    setSubmitting(true);
    setError(null);
    try {
      const fallbackUrl = client.getFallbackAuthUrl(AuthType.Sso, session);
      await waitForSsoFallback(fallbackUrl, client.getHomeserverUrl(), {
        confirmDone: confirmSsoDone,
      });

      const result = await activeActionRef.current({ session });
      if (result && typeof result === 'object' && 'flows' in result) {
        setChallenge({
          ...challenge,
          authData: result as IAuthData,
        });
        throw new Error('Additional auth stages required');
      }
      const ctx = activeContextRef.current;
      setChallenge(null);
      activeActionRef.current = null;
      activeContextRef.current = {};
      onSuccess?.(ctx);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'sso_popup_closed') {
        toast.error(t('settings.sessions.ssoCancelled'));
      } else {
        const msg = getErrorMessage(err);
        setError(msg);
        toast.error(msg);
        onError?.(err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [client, challenge, confirmSsoDone, onSuccess, onError, toast, t]);

  const handleCancel = useCallback(() => {
    setChallenge(null);
    activeActionRef.current = null;
    activeContextRef.current = {};
    setError(null);
  }, []);

  return {
    challenge,
    setChallenge,
    submitting,
    error,
    setError,
    execute,
    handlePassword,
    handleSso,
    handleCancel,
  };
}
