import type { Room } from 'matrix-js-sdk';
import { getSingleStateEvent } from '@/util/matrix';
import type { MemberEntry } from './useMembers';

const CREATORS_MIN_ROOM_VERSION = 12;

export const FOUNDER_ROLE_KEY = 'founder';

export type RoleKey = string;

export interface RoleBearingMember {
  userId: string;
  powerLevel: number;
}

const BASE_ROLE_LABEL_KEYS: Record<number, string> = {
  100: 'room.members.admin',
  50: 'room.members.moderator',
  0: 'room.members.member',
};

const BASE_ROLE_LEVELS_DESC = Object.keys(BASE_ROLE_LABEL_KEYS)
  .map(Number)
  .sort((a, b) => b - a);

export const BASE_ROLE_LEVELS: readonly number[] = BASE_ROLE_LEVELS_DESC;

function parseRoleKey(roleKey: RoleKey): number | null {
  if (roleKey === FOUNDER_ROLE_KEY) return null;
  const level = Number(roleKey);
  return Number.isFinite(level) ? level : null;
}

export function getRoomCreators(room: Room | null | undefined): Set<string> {
  const creators = new Set<string>();
  if (!room) return creators;

  const version = Number.parseInt(room.getVersion(), 10);
  if (!Number.isFinite(version) || version < CREATORS_MIN_ROOM_VERSION) return creators;

  const createEvent = getSingleStateEvent(room, 'm.room.create');
  if (!createEvent) return creators;

  const sender = createEvent.getSender();
  if (sender) creators.add(sender);

  const content = createEvent.getContent<{ additional_creators?: unknown }>();
  const additional = content.additional_creators;
  if (Array.isArray(additional)) {
    for (const creator of additional) {
      if (typeof creator === 'string') creators.add(creator);
    }
  }

  return creators;
}

export function getRoleKey(member: RoleBearingMember, creators: Set<string>): RoleKey {
  if (creators.has(member.userId)) return FOUNDER_ROLE_KEY;
  return String(member.powerLevel);
}

export function getRoleRank(roleKey: RoleKey): number {
  if (roleKey === FOUNDER_ROLE_KEY) return Number.POSITIVE_INFINITY;
  return parseRoleKey(roleKey) ?? Number.NEGATIVE_INFINITY;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function getRoleLabel(roleKey: RoleKey, t: Translate): string {
  if (roleKey === FOUNDER_ROLE_KEY) return t('room.members.founder');

  const level = parseRoleKey(roleKey);
  if (level === null) return t('room.members.levelFallback', { level: roleKey });

  const exact = BASE_ROLE_LABEL_KEYS[level];
  if (exact) return t(exact);

  if (level < 0) return t('room.members.roleAtLevel', { role: t('room.members.muted'), level });

  if (level > BASE_ROLE_LEVELS_DESC[0]) {
    return t('room.members.levelFallback', { level });
  }

  const nearestBelow = BASE_ROLE_LEVELS_DESC.find((known) => known < level) ?? 0;

  return t('room.members.roleAtLevel', {
    role: t(BASE_ROLE_LABEL_KEYS[nearestBelow]),
    level,
  });
}

export interface RoleHeaderItem {
  kind: 'role';
  roleKey: RoleKey;
  label: string;
  count: number;
}

export interface MemberListItem {
  kind: 'member';
  member: MemberEntry;
}

export type RoleSectionItem = RoleHeaderItem | MemberListItem;

export function isRoleHeader(item: RoleSectionItem): item is RoleHeaderItem {
  return item.kind === 'role';
}

export function buildRoleSections(
  sortedMembers: MemberEntry[],
  creators: Set<string>,
  t: Translate
): RoleSectionItem[] {
  const items: RoleSectionItem[] = [];
  let currentRoleKey: RoleKey | null = null;
  let currentHeader: RoleHeaderItem | null = null;

  for (const member of sortedMembers) {
    const roleKey = getRoleKey(member, creators);

    if (roleKey !== currentRoleKey || currentHeader === null) {
      currentRoleKey = roleKey;
      currentHeader = { kind: 'role', roleKey, label: getRoleLabel(roleKey, t), count: 0 };
      items.push(currentHeader);
    }

    items.push({ kind: 'member', member });
    currentHeader.count += 1;
  }

  return items;
}
