import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { grantsAtom, installedIntegrationsAtom } from '../store';
import { matchLinkCard, type LinkCardMatch } from '../matching';

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const MAX_CARDS = 3;

export interface IntegrationCardData extends LinkCardMatch {
  url: string;
  iconDataUrl?: string;
}

/** Local-only: matches links in a message body against installed link-card rules. No network. */
export function useIntegrationCards(body?: string, formattedBody?: string): IntegrationCardData[] {
  const installed = useAtomValue(installedIntegrationsAtom);
  const grants = useAtomValue(grantsAtom);
  return useMemo(() => {
    if (installed.length === 0) return [];
    const seen = new Set<string>();
    const out: IntegrationCardData[] = [];
    for (const src of [body, formattedBody]) {
      for (const raw of src?.match(URL_RE) ?? []) {
        if (out.length >= MAX_CARDS) return out;
        const url = raw.replace(/[.,!?;:)"'\]]+$/, '');
        if (!seen.has(url)) {
          seen.add(url);
          const m = matchLinkCard(url, installed, grants);
          if (m) {
            out.push({
              ...m,
              url,
              iconDataUrl: installed.find((i) => i.id === m.integrationId)?.iconDataUrl,
            });
          }
        }
      }
    }
    return out;
  }, [body, formattedBody, installed, grants]);
}
