import type { MatrixClient } from 'matrix-js-sdk';
import { AuthType } from 'matrix-js-sdk/lib/interactive-auth';
import type { UIAuthCallback } from 'matrix-js-sdk/lib/interactive-auth';
import { waitForSsoFallback } from '@/app/features/sso/sso';
import type { CrossSigningUiaState } from '@/app/store/atoms';

export type CrossSigningUiaResult =
  | { type: 'password'; password: string }
  | { type: 'sso' }
  | { type: 'reset' }
  | null;

export function buildCrossSigningUiaCallback(
  client: MatrixClient,
  setCrossSigningUia: (state: CrossSigningUiaState) => void,
  t: (key: string) => string
): UIAuthCallback<void> {
  return async (makeRequest) => {
    try {
      await makeRequest(null);
      return;
    } catch (err: unknown) {
      const e = err as {
        httpStatus?: number;
        data?: {
          flows?: { stages: string[] }[];
          session?: string;
          params?: Record<string, { url?: string }>;
        };
      };
      if (e?.httpStatus !== 401) throw err;

      const flows = e.data?.flows ?? [];
      const session = e.data?.session ?? '';

      // Delegated-auth servers point at an account-management page instead of UIA.
      const resetStage = flows.find(
        (f) =>
          f.stages.includes(AuthType.OAuth) || f.stages.includes('org.matrix.cross_signing_reset')
      );
      const resetUrl =
        e.data?.params?.[AuthType.OAuth]?.url ??
        e.data?.params?.['org.matrix.cross_signing_reset']?.url;

      if (resetStage && resetUrl) {
        const result = await new Promise<CrossSigningUiaResult>((resolve) =>
          setCrossSigningUia({ open: true, offerSso: false, resetUrl, resolve })
        );
        if (result === null) throw new Error('UIA cancelled');
        await makeRequest({ type: AuthType.OAuth, session });
        return;
      }

      const offersSso = flows.some(
        (f) => f.stages.includes(AuthType.Sso) || f.stages.includes(AuthType.SsoUnstable)
      );

      let modalError: string | undefined;
      while (true) {
        const result = await new Promise<CrossSigningUiaResult>((resolve) =>
          setCrossSigningUia({ open: true, offerSso: offersSso, error: modalError, resolve })
        );

        if (result === null) throw new Error('UIA cancelled');
        if (result.type === 'reset') continue; // not offered here; ignore defensively

        if (result.type === 'sso') {
          try {
            const fallbackUrl = client.getFallbackAuthUrl(AuthType.Sso, session);
            await waitForSsoFallback(fallbackUrl, client.getHomeserverUrl());
            await makeRequest({ session });
            return;
          } catch (ssoErr: unknown) {
            if (ssoErr instanceof Error && ssoErr.message === 'sso_popup_closed') {
              modalError = t('settings.sessions.ssoCancelled');
              continue;
            }
            throw ssoErr;
          }
        }

        try {
          await makeRequest({
            type: AuthType.Password,
            identifier: { type: 'm.id.user', user: client.getUserId() ?? '' },
            password: result.password,
            session,
          });
          return;
        } catch (retryErr: unknown) {
          const re = retryErr as { httpStatus?: number };
          if (re?.httpStatus === 401) {
            modalError = t('settings.sessions.incorrectPassword');
            // loop — open modal again with error
          } else {
            throw retryErr;
          }
        }
      }
    }
  };
}
