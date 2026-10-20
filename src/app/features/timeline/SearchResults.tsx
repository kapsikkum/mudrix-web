import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { highlightTerms } from '@/app/hooks/useSearch';
import type { ServerSearchResult } from '@/app/hooks/useServerSearch';
import { formatShortDateLabel, formatTime } from '@/util/format';
import { Spinner } from '@/app/components/Spinner';
import * as css from './SearchResults.css';

const SNIPPET_RADIUS = 140;

/** Trim long bodies to a window around the first matched term. */
function makeSnippet(body: string, terms: string[]): string {
  if (body.length <= SNIPPET_RADIUS * 2) return body;
  const lower = body.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return `${body.slice(0, SNIPPET_RADIUS * 2)}…`;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(body.length, at + SNIPPET_RADIUS);
  return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`;
}

interface Props {
  client: MatrixClient;
  query: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  results: ServerSearchResult[];
  highlights: string[];
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onJump: (result: ServerSearchResult) => void;
}

export function SearchResults({
  client,
  query,
  status,
  results,
  highlights,
  hasMore,
  loadingMore,
  error,
  onLoadMore,
  onJump,
}: Props) {
  const { t, i18n } = useTranslation();
  const terms = highlights.length > 0 ? highlights : query.split(/\s+/).filter(Boolean);

  if (status === 'loading' || (status === 'idle' && query.trim())) {
    return (
      <div className={css.status}>
        <Spinner />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`${css.status} ${css.statusError}`}>
        {t('room.header.serverSearchFailed', { error })}
      </div>
    );
  }

  if (results.length === 0) {
    return <div className={css.status}>{t('room.header.searchEmpty', { query })}</div>;
  }

  return (
    <div className={css.list}>
      {results.map((r) => {
        const roomName = client.getRoom(r.roomId)?.name ?? r.roomId;
        const parts = highlightTerms(makeSnippet(r.body, terms), terms);
        return (
          <button key={r.eventId} type="button" className={css.item} onClick={() => onJump(r)}>
            <span className={css.itemMeta}>
              <span className={css.itemSender}>{r.senderName}</span>
              <span className={css.itemRoom}>{roomName}</span>
              <span className={css.itemTime}>
                {formatShortDateLabel(r.ts, t, i18n.language)} {formatTime(r.ts, i18n.language)}
              </span>
            </span>
            <span className={css.itemBody}>
              {parts.map((p, i) =>
                p.highlighted ? (
                  <mark key={i} className={css.highlight}>
                    {p.text}
                  </mark>
                ) : (
                  <span key={i}>{p.text}</span>
                )
              )}
            </span>
          </button>
        );
      })}
      {hasMore && (
        <button type="button" className={css.loadMore} onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? t('common.searching') : t('room.header.loadMoreResults')}
        </button>
      )}
    </div>
  );
}
