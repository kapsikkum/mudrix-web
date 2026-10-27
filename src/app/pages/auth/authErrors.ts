import type { TFunction } from 'i18next';
import { ConnectionError } from 'matrix-js-sdk';
import { DiscoveryStatus, type AuthCapabilities } from '@/app/features/sso/sso';
import { getErrorMessage } from '@/util/error';

interface MatrixLikeError {
  errcode?: string;
  httpStatus?: number;
  data?: { errcode?: string; error?: string; retry_after_ms?: number };
}

function errcodeOf(err: unknown): string | undefined {
  const e = err as MatrixLikeError | null;
  return e?.errcode ?? e?.data?.errcode;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof ConnectionError) return true;
  if (err instanceof TypeError) return true; // fetch: "Failed to fetch"
  return err instanceof Error && err.name === 'ConnectionError';
}

/** Why the selected server cannot be used right now, said so people know what to do. */
export function serverProblemMessage(caps: AuthCapabilities | null, t: TFunction): string {
  if (!caps) return t('welcome.errServerIncomplete');
  if (caps.discoveryStatus === DiscoveryStatus.NotMatrix) return t('welcome.errNotAServer');
  return t('welcome.errServerUnreachable');
}

/** A failed sign-in or sign-up, in words that say what to do next. */
export function authErrorMessage(
  err: unknown,
  t: TFunction,
  ctx: { server: string; byEmail?: boolean }
): string {
  if (isNetworkError(err)) return t('welcome.errNetwork', { server: ctx.server });
  const code = errcodeOf(err);
  switch (code) {
    case 'M_FORBIDDEN':
      return ctx.byEmail
        ? t('welcome.errWrongEmail', { server: ctx.server })
        : t('welcome.errWrongPassword', { server: ctx.server });
    case 'M_USER_DEACTIVATED':
      return t('welcome.errDeactivated');
    case 'M_LIMIT_EXCEEDED': {
      const ms = (err as MatrixLikeError).data?.retry_after_ms;
      return ms
        ? t('welcome.errRateLimitedFor', { seconds: Math.max(2, Math.ceil(ms / 1000)) })
        : t('welcome.errRateLimited');
    }
    case 'M_INVALID_USERNAME':
    case 'M_INVALID_PARAM':
    case 'M_UNKNOWN':
    case 'M_UNRECOGNIZED':
      if (ctx.byEmail) return t('welcome.errNoEmailLogin');
      if (code === 'M_INVALID_USERNAME') return t('welcome.errBadUsername');
      break;
    default:
      break;
  }
  const message = (err as MatrixLikeError | null)?.data?.error ?? getErrorMessage(err);
  return t('welcome.errGeneric', { error: message });
}
