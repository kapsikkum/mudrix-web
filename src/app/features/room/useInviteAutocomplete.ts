import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { formatUserId } from '@/util/matrix';

import { STORAGE_KEY_RECENT_INVITES } from '@/const/storageKeys';

const RECENT_KEY = STORAGE_KEY_RECENT_INVITES;
const MAX_RECENT = 20;

export interface RecentUser {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  timestamp: number;
}

function getRecentUsers(): RecentUser[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function trackRecentInvite(userId: string, displayName: string, avatarMxc: string | null) {
  const recent = getRecentUsers().filter((u) => u.userId !== userId);
  recent.unshift({ userId, displayName, avatarMxc, timestamp: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export interface UserSuggestion {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  source: 'recent' | 'directory';
}

export interface InviteAutocompleteState {
  open: boolean;
  suggestions: UserSuggestion[];
  selectedIndex: number;
  loading: boolean;
}

const CLOSED: InviteAutocompleteState = {
  open: false,
  suggestions: [],
  selectedIndex: 0,
  loading: false,
};

export function useInviteAutocomplete(client: MatrixClient) {
  const [state, setState] = useState<InviteAutocompleteState>(CLOSED);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, pre-populate with DM partners as "recent users" source
  // (we also pull from localStorage recent-invites)
  const getDmUsers = useCallback((): UserSuggestion[] => {
    const dmData = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();
    if (!dmData) return [];

    const myId = client.getUserId();
    const seen = new Set<string>();
    const results: UserSuggestion[] = [];

    for (const [userId, roomIds] of Object.entries(dmData)) {
      if (userId === myId) continue;
      if (seen.has(userId)) continue;
      seen.add(userId);

      // Find the most recent DM room for this user to get their display name + avatar
      let displayName = formatUserId(userId);
      let avatarMxc: string | null = null;

      for (const roomId of roomIds) {
        const room = client.getRoom(roomId);
        if (!room) continue;
        const member = room.getMember(userId);
        if (member) {
          displayName = member.name ?? displayName;
          avatarMxc = member.getMxcAvatarUrl() ?? null;
          break;
        }
      }

      results.push({ userId, displayName, avatarMxc, source: 'recent' });
    }

    return results;
  }, [client]);

  const buildRecentList = useCallback((): UserSuggestion[] => {
    const stored = getRecentUsers();
    const dmUsers = getDmUsers();

    const seen = new Set<string>();
    const merged: UserSuggestion[] = [];

    // localStorage recent invites first (most recently invited)
    for (const u of stored) {
      if (seen.has(u.userId)) continue;
      seen.add(u.userId);
      merged.push({
        userId: u.userId,
        displayName: u.displayName,
        avatarMxc: u.avatarMxc,
        source: 'recent',
      });
    }

    // Then DM users
    for (const u of dmUsers) {
      if (seen.has(u.userId)) continue;
      seen.add(u.userId);
      merged.push(u);
    }

    return merged;
  }, [getDmUsers]);

  const directoryQuery = useQuery({
    queryKey: ['user-directory', debouncedQuery],
    queryFn: async ({ signal }) => {
      const result = await client.searchUserDirectory({ term: debouncedQuery, limit: 5 });
      if (signal.aborted) return [];
      const myId = client.getUserId();
      return result.results
        .filter((r) => r.user_id !== myId)
        .map((r) => ({
          userId: r.user_id,
          displayName: r.display_name ?? formatUserId(r.user_id),
          avatarMxc: r.avatar_url ?? null,
          source: 'directory' as const,
        }));
    },
    enabled: !!debouncedQuery,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  // Merge directory results with recent matches when directory query resolves
  useEffect(() => {
    if (!debouncedQuery || !directoryQuery.data) return;

    const q = debouncedQuery.toLowerCase();
    const recentMatches = buildRecentList().filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q)
    );

    const recentIds = new Set(recentMatches.map((u) => u.userId));
    const dedupedDirectory = directoryQuery.data.filter((u) => !recentIds.has(u.userId));

    const merged = [...recentMatches, ...dedupedDirectory];

    setState({
      open: merged.length > 0,
      suggestions: merged,
      selectedIndex: 0,
      loading: false,
    });
  }, [directoryQuery.data, debouncedQuery, buildRecentList]);

  // Sync loading state from React Query (handles fetch failure too)
  useEffect(() => {
    if (!debouncedQuery) return;
    if (!directoryQuery.isLoading) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [directoryQuery.isLoading, debouncedQuery]);

  const open = useCallback(() => {
    const recent = buildRecentList().slice(0, MAX_RECENT);
    setState({
      open: recent.length > 0,
      suggestions: recent,
      selectedIndex: 0,
      loading: false,
    });
  }, [buildRecentList]);

  const close = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncedQuery('');
    setState(CLOSED);
  }, []);

  const onInput = useCallback(
    (query: string) => {
      // Cancel pending debounce and any in-flight RQ query
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setDebouncedQuery('');

      const q = query.trim().toLowerCase();

      if (!q) {
        // Empty input shows recent users
        const recent = buildRecentList().slice(0, MAX_RECENT);
        setState({
          open: recent.length > 0,
          suggestions: recent,
          selectedIndex: 0,
          loading: false,
        });
        return;
      }

      // Filter recent users immediately (instant feedback)
      const recentMatches = buildRecentList().filter(
        (u) => u.displayName.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q)
      );

      // Show filtered recent results immediately, mark loading for directory
      setState({
        open: true,
        suggestions: recentMatches,
        selectedIndex: 0,
        loading: true,
      });

      // Debounce directory search 300ms
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(q);
      }, 300);
    },
    [buildRecentList]
  );

  const onArrow = useCallback(
    (direction: 'up' | 'down'): boolean => {
      if (!state.open || state.suggestions.length === 0) return false;
      setState((prev) => ({
        ...prev,
        selectedIndex:
          direction === 'down'
            ? Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
            : Math.max(prev.selectedIndex - 1, 0),
      }));
      return true;
    },
    [state.open, state.suggestions.length]
  );

  const confirm = useCallback((): UserSuggestion | null => {
    if (!state.open || state.suggestions.length === 0) return null;
    return state.suggestions[state.selectedIndex] ?? null;
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { state, open, close, onInput, onArrow, confirm };
}
