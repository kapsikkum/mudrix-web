import type { MatrixClient } from 'matrix-js-sdk';
import { roomState } from '@/util/matrix';

import rawEmojiData from 'emojibase-data/en/data.json';
import rawMessages from 'emojibase-data/en/messages.json';

const messages = rawMessages as MessagesDataset;

interface MessagesDataset {
  groups: { key: string; message: string; order: number }[];
  subgroups: { key: string; message: string; order: number }[];
  skinTones: { key: string; message: string }[];
}

interface RawEmoji {
  hexcode: string;
  emoji: string;
  label: string;
  tags?: string[];
  group?: number;
  subgroup?: number;
  order?: number;
  skins?: RawEmoji[];
  tone?: number | number[];
  type: number;
  version: number;
}

export interface EmojiItem {
  hexcode: string;
  emoji: string;
  label: string;
  tags: string[];
  skins?: EmojiItem[];
}

export interface CustomEmojiItem {
  shortcode: string;
  url: string;
  label: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  emojis: EmojiItem[];
  icon: string;
  type: 'standard';
}

export interface CustomPackCategory {
  id: string;
  label: string;
  emojis: CustomEmojiItem[];
  type: 'pack';
}

export type PickerCategory = EmojiCategory | CustomPackCategory;

const EMOJI_GROUP_ICONS: Record<string, string> = {
  'smileys-emotion': '😀',
  'people-body': '🧑',
  'animals-nature': '🐶',
  'food-drink': '🍕',
  'travel-places': '✈️',
  activities: '⚽',
  objects: '💡',
  symbols: '💟',
  flags: '🏁',
};

const SKIP_GROUPS = new Set([2, undefined]);

let cachedCategories: EmojiCategory[] | null = null;

function buildEmojiData(): EmojiCategory[] {
  if (cachedCategories) return cachedCategories;

  const data = rawEmojiData as unknown as RawEmoji[];
  const groups = messages.groups.sort((a, b) => a.order - b.order);

  const categories: EmojiCategory[] = [];
  const groupMap = new Map<number, EmojiItem[]>();

  for (const emoji of data) {
    if (SKIP_GROUPS.has(emoji.group)) continue;
    if (!emoji.emoji) continue;

    const item: EmojiItem = {
      hexcode: emoji.hexcode,
      emoji: emoji.emoji,
      label: emoji.label,
      tags: emoji.tags ?? [],
      skins: emoji.skins
        ?.filter((s) => s.emoji)
        .map((s) => ({
          hexcode: s.hexcode,
          emoji: s.emoji!,
          label: s.label,
          tags: s.tags ?? [],
        })),
    };

    const list = groupMap.get(emoji.group!);
    if (list) {
      list.push(item);
    } else {
      groupMap.set(emoji.group!, [item]);
    }
  }

  for (const group of groups) {
    const groupIndex = group.order;
    const emojis = groupMap.get(groupIndex);
    if (!emojis || emojis.length === 0) continue;

    categories.push({
      id: group.key,
      label: group.message,
      emojis,
      icon: EMOJI_GROUP_ICONS[group.key] ?? '',
      type: 'standard',
    });
  }

  cachedCategories = categories;
  return categories;
}

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';

function getPackEmoji(client: MatrixClient, roomId: string): CustomPackCategory[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  const state = roomState(room);
  const raw = state?.getStateEvents(PONIES_ROOM_EMOTES);
  const events = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (events.length === 0) return [];

  const packs: CustomPackCategory[] = [];

  for (const ev of events) {
    const content = ev.getContent() as Record<string, unknown>;
    const pack = content?.pack as Record<string, unknown> | undefined;
    const packUsage = pack?.usage as string[] | undefined;
    const packName: string = (pack?.display_name as string) || ev.getStateKey() || '';
    const images = content?.images as Record<string, { url: string; usage?: string[] }> | undefined;
    if (!images) continue;

    const emojis: CustomEmojiItem[] = [];
    for (const [shortcode, img] of Object.entries(images)) {
      const imgUsage = img.usage ?? packUsage ?? ['emoticon', 'sticker'];
      if (img.url && imgUsage.includes('emoticon')) {
        emojis.push({
          shortcode,
          url: img.url,
          label: shortcode,
        });
      }
    }

    if (emojis.length > 0) {
      packs.push({
        id: `pack-${ev.getStateKey()}`,
        label: packName,
        emojis,
        type: 'pack',
      });
    }
  }

  return packs;
}

export function getAllCategories(client: MatrixClient, roomId: string): PickerCategory[] {
  const standard = buildEmojiData();
  const packs = getPackEmoji(client, roomId);

  if (packs.length === 0) return standard;
  return [...packs, ...standard];
}

export function searchEmoji(query: string, categories: PickerCategory[]): PickerCategory[] {
  const q = query.toLowerCase().trim();
  if (!q) return categories;

  return categories
    .map((cat) => {
      if (cat.type === 'pack') {
        const filtered = cat.emojis.filter(
          (e) => e.shortcode.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)
        );
        if (filtered.length === 0) return null;
        return { ...cat, emojis: filtered };
      }

      const filtered = cat.emojis.filter(
        (e) => e.tags.some((t) => t.toLowerCase().includes(q)) || e.label.toLowerCase().includes(q)
      );
      if (filtered.length === 0) return null;
      return { ...cat, emojis: filtered };
    })
    .filter(Boolean) as PickerCategory[];
}
