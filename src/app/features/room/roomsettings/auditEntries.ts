import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { formatUserId } from '@/util/matrix';
import { legacyTypeOf } from '@/util/namespace';
import {
  SPACE_MEMBER_ROLES_STATE_TYPE,
  SPACE_ROLES_STATE_TYPE,
} from '@/app/features/space/spaceRoles';

/**
 * A readable "who changed what" list built from a room's state events (they are the room's
 * history of members, permissions, settings and, for a space, its rooms and roles).
 */

export type AuditCategory = 'members' | 'permissions' | 'settings' | 'rooms' | 'roles';

export const AUDIT_CATEGORIES: AuditCategory[] = [
  'members',
  'permissions',
  'settings',
  'rooms',
  'roles',
];

/** What happened, as a translation key under `room.settings.auditLog.action` plus its values. */
export interface AuditEntry {
  id: string;
  ts: number;
  category: AuditCategory;
  actor: string;
  /** Key below `room.settings.auditLog.action.` */
  action: string;
  values: Record<string, string>;
}

type Content = Record<string, unknown>;

const asRecord = (v: unknown): Content =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Content) : {};

function nameOf(room: Room, userId: string): string {
  return room.getMember(userId)?.name || formatUserId(userId) || userId;
}

function roomNameOf(room: Room, roomId: string): string {
  const child = room.client.getRoom(roomId);
  return child?.name || roomId;
}

/** "Admin", "Moderator", "Member" or the number, as a key suffix or the raw level. */
export function levelValue(level: number): { key: string | null; level: string } {
  if (level >= 100) return { key: 'admin', level: String(level) };
  if (level >= 50) return { key: 'moderator', level: String(level) };
  if (level <= 0) return { key: 'member', level: String(level) };
  return { key: null, level: String(level) };
}

function memberEntries(ev: MatrixEvent, room: Room): Omit<AuditEntry, 'id' | 'ts'>[] {
  const target = ev.getStateKey() ?? '';
  const sender = ev.getSender() ?? '';
  const now = String(ev.getContent().membership ?? '');
  const before = String(ev.getPrevContent().membership ?? 'leave');
  const self = sender === target;
  const values = { target: nameOf(room, target) };
  const entry = (action: string): Omit<AuditEntry, 'id' | 'ts'>[] => [
    { category: 'members', actor: nameOf(room, sender), action, values },
  ];

  if (now === 'invite') return entry('invited');
  if (now === 'join' && before !== 'join') return entry('joined');
  if (now === 'knock') return entry('knocked');
  if (now === 'ban') return entry('banned');
  if (now === 'leave') {
    if (before === 'ban') return entry('unbanned');
    if (before === 'invite') return entry(self ? 'inviteDeclined' : 'inviteRevoked');
    if (before === 'join') return entry(self ? 'left' : 'kicked');
    if (before === 'knock') return entry(self ? 'knockCancelled' : 'knockDenied');
  }
  return [];
}

function powerEntries(ev: MatrixEvent, room: Room): Omit<AuditEntry, 'id' | 'ts'>[] {
  const actor = nameOf(room, ev.getSender() ?? '');
  const now = asRecord(ev.getContent().users);
  const before = asRecord(ev.getPrevContent().users);
  const out: Omit<AuditEntry, 'id' | 'ts'>[] = [];
  const ids = new Set([...Object.keys(now), ...Object.keys(before)]);
  ids.forEach((userId) => {
    const from = typeof before[userId] === 'number' ? (before[userId] as number) : 0;
    const to = typeof now[userId] === 'number' ? (now[userId] as number) : 0;
    if (from === to) return;
    out.push({
      category: 'permissions',
      actor,
      action: 'powerChanged',
      values: { target: nameOf(room, userId), from: String(from), to: String(to) },
    });
  });
  // Something other than a person's level changed (who may do what).
  const rest = (c: Content) => {
    const others = { ...c };
    delete others.users;
    return JSON.stringify(others);
  };
  if (
    rest(ev.getContent()) !== rest(ev.getPrevContent()) &&
    ev.getPrevContent().users !== undefined
  ) {
    out.push({ category: 'permissions', actor, action: 'permissionsChanged', values: {} });
  }
  return out;
}

/** The entries one state event stands for (none for events that aren't worth listing). */
export function auditEntriesFor(ev: MatrixEvent, room: Room): AuditEntry[] {
  if (!ev.isState() || ev.isRedacted()) return [];
  const actor = nameOf(room, ev.getSender() ?? '');
  const content = ev.getContent();
  const prev = ev.getPrevContent();
  const single = (
    category: AuditCategory,
    action: string,
    values: Record<string, string> = {}
  ): Omit<AuditEntry, 'id' | 'ts'>[] => [{ category, actor, action, values }];

  let parts: Omit<AuditEntry, 'id' | 'ts'>[] = [];
  switch (ev.getType()) {
    case 'm.room.member':
      parts = memberEntries(ev, room);
      break;
    case 'm.room.power_levels':
      parts = powerEntries(ev, room);
      break;
    case 'm.room.name':
      parts = content.name
        ? single('settings', 'renamed', { name: String(content.name) })
        : single('settings', 'nameRemoved');
      break;
    case 'm.room.topic':
      parts = single('settings', 'topicChanged');
      break;
    case 'm.room.avatar':
      parts = single('settings', content.url ? 'avatarChanged' : 'avatarRemoved');
      break;
    case 'm.room.join_rules':
      if (content.join_rule !== prev.join_rule) {
        parts = single('settings', 'joinRulesChanged', { rule: String(content.join_rule ?? '') });
      }
      break;
    case 'm.room.history_visibility':
      if (content.history_visibility !== prev.history_visibility) {
        parts = single('settings', 'historyChanged');
      }
      break;
    case 'm.room.encryption':
      parts = single('settings', 'encryptionOn');
      break;
    case 'm.room.canonical_alias':
      parts = single('settings', 'aliasChanged');
      break;
    case 'm.room.tombstone':
      parts = single('settings', 'upgraded');
      break;
    case 'm.space.child': {
      const roomId = ev.getStateKey() ?? '';
      const added = Array.isArray(content.via) && content.via.length > 0;
      const wasThere = Array.isArray(prev.via) && prev.via.length > 0;
      if (added === wasThere) break;
      parts = single('rooms', added ? 'roomAdded' : 'roomRemoved', {
        room: roomNameOf(room, roomId),
      });
      break;
    }
    case SPACE_ROLES_STATE_TYPE:
    case legacyTypeOf(SPACE_ROLES_STATE_TYPE):
      parts = single('roles', 'rolesChanged');
      break;
    case SPACE_MEMBER_ROLES_STATE_TYPE:
    case legacyTypeOf(SPACE_MEMBER_ROLES_STATE_TYPE):
      parts = single('roles', 'memberRolesChanged', {
        target: nameOf(room, ev.getStateKey() ?? ''),
      });
      break;
    default:
      break;
  }
  return parts.map((p, i) => ({
    ...p,
    id: `${ev.getId() ?? ev.getTs()}:${i}`,
    ts: ev.getTs(),
  }));
}

/** Every entry in the events, newest first. */
export function buildAuditLog(events: readonly MatrixEvent[], room: Room): AuditEntry[] {
  return events.flatMap((ev) => auditEntriesFor(ev, room)).sort((a, b) => b.ts - a.ts);
}
