import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchOrderBy } from 'matrix-js-sdk';
import type { MatrixClient, ISearchRequestBody, ISearchResult } from 'matrix-js-sdk';
import { getErrorMessage } from '@/util/error';
import { formatUserId } from '@/util/matrix';

const DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

export interface ServerSearchResult {
  eventId: string;
  roomId: string;
  senderId: string;
  senderName: string;
  ts: number;
  body: string;
}

export type ServerSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ServerSearchState {
  status: ServerSearchStatus;
  results: ServerSearchResult[];
  highlights: string[];
  count: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  error: string | null;
}

const IDLE: ServerSearchState = {
  status: 'idle',
  results: [],
  highlights: [],
  count: null,
  hasMore: false,
  loadingMore: false,
  error: null,
};

function buildBody(roomId: string, term: string): ISearchRequestBody {
  return {
    search_categories: {
      room_events: {
        search_term: term,
        keys: ['content.body'],
        filter: { rooms: [roomId], limit: PAGE_SIZE },
        order_by: SearchOrderBy.Recent,
        event_context: { before_limit: 0, after_limit: 0, include_profile: true },
      },
    },
  };
}

function toResult(client: MatrixClient, r: ISearchResult): ServerSearchResult | null {
  const ev = r.result;
  if (!ev?.event_id || !ev.room_id) return null;
  const content = (ev.content ?? {}) as { body?: unknown };
  const senderId = ev.sender ?? '';
  const room = client.getRoom(ev.room_id);
  const senderName =
    room?.getMember(senderId)?.name ??
    r.context?.profile_info?.[senderId]?.displayname ??
    formatUserId(senderId);
  return {
    eventId: ev.event_id,
    roomId: ev.room_id,
    senderId,
    senderName,
    ts: ev.origin_server_ts,
    body: typeof content.body === 'string' ? content.body : '',
  };
}

/**
 * Server-side (`POST /search`) message search scoped to one room. Only meaningful for
 * unencrypted rooms: the server can't index ciphertext. Pass `enabled=false` to stay idle.
 */
export function useServerSearch(
  client: MatrixClient,
  roomId: string,
  query: string,
  enabled: boolean
) {
  const [state, setState] = useState<ServerSearchState>(IDLE);
  const bodyRef = useRef<ISearchRequestBody | null>(null);
  const nextBatchRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const term = query.trim();

  useEffect(() => {
    abortRef.current?.abort();
    nextBatchRef.current = undefined;
    seenRef.current = new Set();
    if (!enabled || !term) {
      bodyRef.current = null;
      setState(IDLE);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const body = buildBody(roomId, term);
    bodyRef.current = body;
    setState({ ...IDLE, status: 'loading' });

    const timer = setTimeout(() => {
      client
        .search({ body }, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          const rc = res.search_categories?.room_events;
          const results: ServerSearchResult[] = [];
          for (const r of rc?.results ?? []) {
            const mapped = toResult(client, r);
            if (!mapped || seenRef.current.has(mapped.eventId)) continue;
            seenRef.current.add(mapped.eventId);
            results.push(mapped);
          }
          nextBatchRef.current = rc?.next_batch;
          setState({
            status: 'ready',
            results,
            highlights: rc?.highlights ?? [],
            count: rc?.count ?? null,
            hasMore: !!rc?.next_batch,
            loadingMore: false,
            error: null,
          });
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setState({ ...IDLE, status: 'error', error: getErrorMessage(err) });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [client, roomId, term, enabled]);

  const loadMore = useCallback(() => {
    const body = bodyRef.current;
    const nextBatch = nextBatchRef.current;
    const controller = abortRef.current;
    if (!body || !nextBatch || !controller || controller.signal.aborted) return;
    nextBatchRef.current = undefined; // guard against double triggers
    setState((prev) => ({ ...prev, loadingMore: true }));
    client
      .search({ body, next_batch: nextBatch }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const rc = res.search_categories?.room_events;
        const more: ServerSearchResult[] = [];
        for (const r of rc?.results ?? []) {
          const mapped = toResult(client, r);
          if (!mapped || seenRef.current.has(mapped.eventId)) continue;
          seenRef.current.add(mapped.eventId);
          more.push(mapped);
        }
        nextBatchRef.current = rc?.next_batch;
        setState((prev) => ({
          ...prev,
          results: [...prev.results, ...more],
          highlights: rc?.highlights?.length ? rc.highlights : prev.highlights,
          hasMore: !!rc?.next_batch,
          loadingMore: false,
        }));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        nextBatchRef.current = nextBatch; // allow retry
        setState((prev) => ({ ...prev, loadingMore: false, error: getErrorMessage(err) }));
      });
  }, [client]);

  return { ...state, loadMore };
}
