import { useState, useMemo, useCallback, useRef } from 'react';
import type { TimelineItem } from './useTimeline';

export interface SearchState {
  query: string;
  matchIndices: number[]; // indices into the items array that match
  activeMatch: number; // which match index is currently focused (0-based within matchIndices)
}

const EMPTY: SearchState = { query: '', matchIndices: [], activeMatch: 0 };

function itemMatchesQuery(item: TimelineItem, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  const content = item.event.getContent();
  const body: string = (content?.body as string) ?? '';
  const formattedBody: string = (content?.formatted_body as string) ?? '';
  return (
    body.toLowerCase().includes(q) ||
    formattedBody.toLowerCase().includes(q) ||
    item.senderName.toLowerCase().includes(q)
  );
}

const DEBOUNCE_MS = 150;

export function useSearch(items: TimelineItem[]) {
  const [search, setSearch] = useState<SearchState>(EMPTY);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const setQuery = useCallback((query: string) => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSearch(EMPTY);
      return;
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const matchIndices: number[] = [];
      itemsRef.current.forEach((item, i) => {
        if (itemMatchesQuery(item, query)) matchIndices.push(i);
      });
      setSearch({ query, matchIndices, activeMatch: 0 });
    }, DEBOUNCE_MS);
  }, []);

  const goToNext = useCallback(() => {
    setSearch((prev) => {
      if (!prev.matchIndices.length) return prev;
      return {
        ...prev,
        activeMatch: (prev.activeMatch + 1) % prev.matchIndices.length,
      };
    });
  }, []);

  const goToPrev = useCallback(() => {
    setSearch((prev) => {
      if (!prev.matchIndices.length) return prev;
      return {
        ...prev,
        activeMatch: (prev.activeMatch - 1 + prev.matchIndices.length) % prev.matchIndices.length,
      };
    });
  }, []);

  const clear = useCallback(() => setSearch(EMPTY), []);

  const filteredItems = useMemo(() => {
    if (!search.query.trim()) return items;
    return search.matchIndices.map((i) => items[i]);
  }, [items, search.query, search.matchIndices]);

  const activeItemIndex = search.matchIndices[search.activeMatch] ?? null;

  return {
    search,
    filteredItems,
    activeItemIndex,
    setQuery,
    goToNext,
    goToPrev,
    clear,
    isSearching: !!search.query.trim(),
  };
}

export function highlightQuery(
  text: string,
  query: string
): Array<{ text: string; highlighted: boolean }> {
  if (!query.trim()) return [{ text, highlighted: false }];
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let cursor = 0;
  let idx: number;
  while ((idx = lower.indexOf(q, cursor)) !== -1) {
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), highlighted: false });
    parts.push({ text: text.slice(idx, idx + q.length), highlighted: true });
    cursor = idx + q.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
  return parts;
}
