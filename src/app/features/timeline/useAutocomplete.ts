import { useState, useCallback } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { STORAGE_KEY_EMOJI_FREQUENCY } from '@/const/storageKeys';
import emojiData from 'emoji-picker-react/dist/data/emojis-en.js';

// Built once on first use, then cached for the session
let EMOJI_LIST: Array<{ id: string; char: string; keywords: string[] }> | null = null;

function unicodeToChar(u: string): string {
  try {
    return String.fromCodePoint(...u.split('-').map((h) => parseInt(h, 16)));
  } catch {
    return '';
  }
}

function getEmojiList() {
  if (EMOJI_LIST) return EMOJI_LIST;
  const allEmojis = Object.values(emojiData.emojis).flat();

  EMOJI_LIST = allEmojis
    .map((e) => ({
      id: e.n[e.n.length - 1]?.replace(/\s+/g, '_').toLowerCase() ?? e.n[0] ?? '',
      char: unicodeToChar(e.u),
      keywords: e.n,
    }))
    .filter((e) => e.char.length > 0 && e.id.length > 0);
  return EMOJI_LIST;
}

const FREQ_KEY = STORAGE_KEY_EMOJI_FREQUENCY;
const MAX_TRACKED = 100;

function getFrequency(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FREQ_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function trackEmojiUsage(char: string) {
  const freq = getFrequency();
  freq[char] = (freq[char] ?? 0) + 1;
  const entries = Object.entries(freq);
  if (entries.length > MAX_TRACKED) {
    entries.sort((a, b) => b[1] - a[1]);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_TRACKED));
    localStorage.setItem(FREQ_KEY, JSON.stringify(trimmed));
  } else {
    localStorage.setItem(FREQ_KEY, JSON.stringify(freq));
  }
}

export type AutocompleteMode = 'emoji' | 'mention';

export interface EmojiSuggestion {
  kind: 'emoji';
  id: string;
  char: string;
}

export interface MentionSuggestion {
  kind: 'mention';
  userId: string;
  displayName: string;
  avatarMxc: string | null;
}

export type Suggestion = EmojiSuggestion | MentionSuggestion;

export interface AutocompleteState {
  open: boolean;
  mode: AutocompleteMode;
  suggestions: Suggestion[];
  selectedIndex: number;
  triggerStart: number; // index in value string where trigger char is
}

const CLOSED: AutocompleteState = {
  open: false,
  mode: 'emoji',
  suggestions: [],
  selectedIndex: 0,
  triggerStart: -1,
};

export function useAutocomplete(client: MatrixClient, roomId: string) {
  const [state, setState] = useState<AutocompleteState>(CLOSED);

  const close = useCallback(() => setState(CLOSED), []);

  const onInput = useCallback(
    (value: string, cursorPos: number) => {
      const textBefore = value.slice(0, cursorPos);

      const emojiMatch = textBefore.match(/:([a-z0-9_+]*)$/);
      if (emojiMatch) {
        const query = emojiMatch[1];
        if (query.length >= 1) {
          const triggerStart = textBefore.lastIndexOf(':');
          const list = getEmojiList();
          const q = query.toLowerCase();
          const freq = getFrequency();

          const results = list
            .filter((e) => e.id.includes(q) || e.keywords.some((k) => k.toLowerCase().includes(q)))
            .map((e) => ({ ...e, freq: freq[e.char] ?? 0 }))
            // Prioritise: starts-with > contains, then by frequency
            .sort((a, b) => {
              const aStarts = a.id.startsWith(q) || a.keywords[0]?.startsWith(q);
              const bStarts = b.id.startsWith(q) || b.keywords[0]?.startsWith(q);
              if (aStarts !== bStarts) return aStarts ? -1 : 1;
              return b.freq - a.freq;
            })
            .slice(0, 6)
            .map((e): EmojiSuggestion => ({ kind: 'emoji', id: e.id, char: e.char }));

          if (results.length > 0) {
            setState({
              open: true,
              mode: 'emoji',
              suggestions: results,
              selectedIndex: 0,
              triggerStart,
            });
            return;
          }
        }
      }

      const mentionMatch = textBefore.match(/@([^\s@]*)$/);
      if (mentionMatch) {
        const query = mentionMatch[1].toLowerCase();
        const triggerStart = textBefore.lastIndexOf('@');
        const room = client.getRoom(roomId);
        const members = room?.getJoinedMembers() ?? [];

        const results = members
          .filter(
            (m) =>
              (m.name ?? m.userId).toLowerCase().includes(query) ||
              m.userId.toLowerCase().includes(query)
          )
          .slice(0, 6)
          .map(
            (m): MentionSuggestion => ({
              kind: 'mention',
              userId: m.userId,
              displayName: m.name ?? m.userId,
              avatarMxc: m.getMxcAvatarUrl() ?? null,
            })
          );

        if (results.length > 0) {
          setState({
            open: true,
            mode: 'mention',
            suggestions: results,
            selectedIndex: 0,
            triggerStart,
          });
          return;
        }
      }

      // Nothing matched — close
      setState(CLOSED);
    },
    [client, roomId]
  );

  const onArrow = useCallback(
    (direction: 'up' | 'down'): boolean => {
      if (!state.open) return false;
      setState((prev) => ({
        ...prev,
        selectedIndex:
          direction === 'down'
            ? Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
            : Math.max(prev.selectedIndex - 1, 0),
      }));
      return true;
    },
    [state.open]
  );

  const confirm = useCallback(
    (
      currentValue: string,
      cursorPos: number
    ): {
      newValue: string;
      newCursor: number;
      mention?: { displayName: string; userId: string };
    } | null => {
      if (!state.open || state.suggestions.length === 0) return null;
      const suggestion = state.suggestions[state.selectedIndex];
      if (!suggestion) return null;

      const before = currentValue.slice(0, state.triggerStart);
      const after = currentValue.slice(cursorPos);

      let insertion: string;
      if (suggestion.kind === 'emoji') {
        insertion = suggestion.char + ' ';
        trackEmojiUsage(suggestion.char);
      } else {
        insertion = `@${suggestion.displayName} `;
      }

      const newValue = before + insertion + after;
      const newCursor = before.length + insertion.length;
      setState(CLOSED);
      const mention =
        suggestion.kind === 'mention'
          ? { displayName: suggestion.displayName, userId: suggestion.userId }
          : undefined;
      return { newValue, newCursor, mention };
    },
    [state]
  );

  return { state, onInput, onArrow, confirm, close };
}
