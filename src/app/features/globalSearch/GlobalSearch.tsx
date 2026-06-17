import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SearchOrderBy } from 'matrix-js-sdk/lib/@types/search';
import { globalSearchOpenAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { MODIFIER_KEY } from '@/app/util/platform';
import { formatUserId, isDmRoom } from '@/util/matrix';
import * as css from './GlobalSearch.css';

interface SearchResult {
  eventId: string;
  roomId: string;
  roomName: string;
  sender: string;
  senderName: string;
  body: string;
  ts: number;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const q = query.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  const lower = text.toLowerCase();
  let cursor = 0;
  let idx: number;
  while ((idx = lower.indexOf(q, cursor)) !== -1) {
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), highlighted: false });
    parts.push({ text: text.slice(idx, idx + q.length), highlighted: true });
    cursor = idx + q.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
  return (
    <>
      {parts.map((p, i) =>
        p.highlighted ? (
          <mark key={i} className={css.highlight}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(globalSearchOpenAtom);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSearched(false);
  }, [setOpen]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  const doSearch = useCallback(
    async (q: string) => {
      if (!client || !q.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const response = await client.search({
          body: {
            search_categories: {
              room_events: {
                search_term: q.trim(),
                order_by: SearchOrderBy.Recent,
                event_context: { before_limit: 0, after_limit: 0, include_profile: true },
              },
            },
          },
        });

        const roomEvents = response.search_categories.room_events;
        const rawResults = roomEvents?.results ?? [];

        const mapped: SearchResult[] = rawResults
          .map((r) => {
            const event = r.result;
            if (!event) return null;
            const roomId = event.room_id ?? '';
            const room = client.getRoom(roomId);
            const roomName = room?.name ?? roomId;
            const sender = event.sender ?? '';
            const member = room?.getMember(sender);
            const senderName = member?.name ?? formatUserId(sender);
            const content = event.content as Record<string, unknown>;
            const body = (content?.body as string) ?? (content?.formatted_body as string) ?? '';

            return {
              eventId: event.event_id ?? '',
              roomId,
              roomName,
              sender,
              senderName,
              body,
              ts: event.origin_server_ts ?? 0,
            } satisfies SearchResult;
          })
          .filter((r): r is SearchResult => r !== null && r.body.length > 0);

        setResults(mapped);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!val.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      debounceRef.current = setTimeout(() => doSearch(val), 400);
    },
    [doSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        doSearch(query);
      }
    },
    [doSearch, query]
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (!client) return;
      const room = client.getRoom(result.roomId);
      const isDm = room ? isDmRoom(room, client) : false;
      navigate(`/${isDm ? 'dm' : 'r'}/${encodeURIComponent(result.roomId)}`);
      close();
    },
    [client, navigate, close]
  );

  if (!open) return null;

  return (
    <div className={css.overlay} onClick={close}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <div className={css.searchBar}>
          <MagnifyingGlassIcon size={18} className={css.searchIcon} />
          <input
            ref={inputRef}
            className={css.searchInput}
            placeholder={t('globalSearch.placeholder', { mod: MODIFIER_KEY })}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className={css.hintText}>{t('common.loading')}</span>}
        </div>

        {/* Results */}
        <div className={css.results}>
          {!query.trim() && (
            <div className={css.statusMessage}>{t('globalSearch.typeToSearch')}</div>
          )}
          {query.trim() && !loading && searched && results.length === 0 && (
            <div className={css.statusMessage}>{t('globalSearch.noResults')}</div>
          )}
          {results.map((r) => (
            <div key={r.eventId} className={css.resultItem} onClick={() => handleSelect(r)}>
              <div className={css.resultMeta}>
                <span className={css.resultRoom}>{r.roomName}</span>
                <span className={css.resultSender}>{r.senderName}</span>
                <span className={css.resultTime}>{formatTime(r.ts)}</span>
              </div>
              <div className={css.resultBody}>
                <HighlightedText text={r.body} query={query} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className={css.footer}>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>Enter</kbd>
            {t('globalSearch.hintSearch')}
          </span>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>Esc</kbd>
            {t('globalSearch.hintClose')}
          </span>
        </div>
      </div>
    </div>
  );
}
