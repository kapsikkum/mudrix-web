import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildLookupUrl, isLookupCached, loadLinkDetails, type LinkDetails } from '../details';
import { lookupShowsAnything } from '../settings';
import type { IntegrationCardData } from './useIntegrationCards';

export type LinkDetailsState =
  | { status: 'none' }
  /** Encrypted room: nothing is asked until the person presses the button. */
  | { status: 'ask'; host: string; load: () => void }
  | { status: 'loading'; host: string }
  | { status: 'ready'; host: string; details: LinkDetails }
  | { status: 'failed'; host: string; error: string; requested: boolean };

type Settled = Extract<LinkDetailsState, { status: 'ready' | 'failed' }>;

/**
 * Looks a card's link up on the integration's approved host. In an unencrypted room that happens
 * when the card is shown (as the room's own link previews would); in an encrypted room only when
 * the person asks, since the link would otherwise leave the device on its own.
 */
export function useLinkDetails(card: IntegrationCardData, isEncrypted: boolean): LinkDetailsState {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const { lookup, captures, settings } = card;
  // The exact request is the identity of everything below (with the settings, which only choose
  // what is shown: changing them re-reads the cached answer, it does not ask again).
  const url = useMemo(() => {
    if (!lookup || !lookupShowsAnything(lookup.lookup, settings)) return null;
    const built = buildLookupUrl(lookup.host, lookup.lookup, captures);
    return built.ok ? built.url : null;
  }, [lookup, captures, settings]);
  const [requestedUrl, setRequestedUrl] = useState<string | null>(null);
  const [settled, setSettled] = useState<{ key: string; state: Settled } | null>(null);
  const requested = url !== null && requestedUrl === url;
  const auto = url !== null && (!isEncrypted || isLookupCached(url));
  const key = `${url}|${locale}|${JSON.stringify(settings)}`;

  useEffect(() => {
    if (!lookup || url === null || (!auto && !requested)) return undefined;
    let alive = true;
    void loadLinkDetails(lookup.host, lookup.lookup, captures, locale, settings).then((res) => {
      if (!alive) return;
      setSettled({
        key,
        state: res.ok
          ? { status: 'ready', host: lookup.host, details: res.details }
          : { status: 'failed', host: lookup.host, error: res.error, requested },
      });
    });
    return () => {
      alive = false;
    };
    // lookup, captures and settings are covered by url (built from them) and key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, auto, requested]);

  const load = useCallback(() => setRequestedUrl(url), [url]);
  if (!lookup || url === null) return { status: 'none' };
  if (!auto && !requested) return { status: 'ask', host: lookup.host, load };
  return settled?.key === key ? settled.state : { status: 'loading', host: lookup.host };
}
