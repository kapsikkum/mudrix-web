import { useSyncExternalStore } from 'react';
import {
  ClientEvent,
  RoomEvent,
  RoomStateEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import { getRoomCreators } from '@/app/features/room/memberRoles';
import { isActiveSpaceChild, roomStateMaybe } from '@/util/matrix';
import { SPACE_LIST_STYLE_STATE_TYPE, readSpaceListStyle } from './spaceListStyle';

/**
 * Space roles: names, colours and badges for people in a space. They are cosmetic. The server only
 * knows power levels, so a role never grants anything; it is a label other members see.
 *
 * - `SPACE_ROLES_STATE_TYPE` (state key ''): the list of roles, in display order.
 * - `SPACE_MEMBER_ROLES_STATE_TYPE` (state key = user id): the role ids that person holds.
 *
 * Roles are part of the Modern room list style: a Matrix style space shows none of them.
 *
 * Both come from untrusted senders, so everything read is validated, and an event only counts when
 * its sender may change the space's state.
 */
export const SPACE_ROLES_STATE_TYPE = 'chat.mudrix.space_roles';
export const SPACE_MEMBER_ROLES_STATE_TYPE = 'chat.mudrix.space_member_roles';

/**
 * A person's assignment is stored under their user id without the leading `@`: servers refuse
 * state keys that look like another user's id.
 */
export const memberStateKey = (userId: string) => userId.replace(/^@/, '');

export const MAX_ROLES = 50;
export const MAX_ROLES_PER_MEMBER = 20;
export const MAX_ROLE_NAME = 32;
/** Roles only count when set by someone at least this powerful, whatever the room allows. */
const MIN_WRITER_LEVEL = 50;

export interface SpaceRole {
  id: string;
  name: string;
  /** `#rrggbb`, already validated. */
  color?: string;
  /** Members with this role are listed under their own heading. */
  hoist?: boolean;
}

/** The roles every Matrix room already has, by power level. They cannot be removed or moved. */
export const BUILTIN_ROLE_KEYS = ['founder', '100', '50', '0'] as const;
export type BuiltinRoleKey = (typeof BUILTIN_ROLE_KEYS)[number];

/** A look given to a built-in role: its name and colour, both optional. */
export interface BuiltinRoleLook {
  name?: string;
  color?: string;
}

export type BuiltinRoleLooks = Partial<Record<BuiltinRoleKey, BuiltinRoleLook>>;

export interface SpaceRoles {
  builtin: BuiltinRoleLooks;
  roles: SpaceRole[];
  /** Roles per person, in the order of `roles`. */
  byUser: Map<string, SpaceRole[]>;
}

const ID_PATTERN = /^[a-z0-9_-]{1,24}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
// Control characters and the invisible direction overrides that can make a name read differently.
/* eslint-disable no-control-regex */
const UNSAFE_CHARS = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]',
  'g'
);
/* eslint-enable no-control-regex */

export function cleanRoleName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ROLE_NAME);
}

export function isValidRoleColor(value: unknown): value is string {
  return typeof value === 'string' && COLOR_PATTERN.test(value);
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;
const ID_UNBIASED_LIMIT = 256 - (256 % ID_CHARS.length);

/** A fresh role id (fits `ID_PATTERN`), from the browser's secure random source. */
export function newRoleId(): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2))) {
      if (byte >= ID_UNBIASED_LIMIT) continue;
      id += ID_CHARS[byte % ID_CHARS.length];
      if (id.length === ID_LENGTH) break;
    }
  }
  return id;
}

/** One role from untrusted content, or null when it is not usable. */
function sanitizeRole(raw: unknown): SpaceRole | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !ID_PATTERN.test(r.id)) return null;
  const name = cleanRoleName(r.name);
  if (!name) return null;
  const role: SpaceRole = { id: r.id, name };
  if (isValidRoleColor(r.color)) role.color = r.color.toLowerCase();
  if (r.hoist === true) role.hoist = true;
  return role;
}

/** Whether `sender` could change this kind of state in the space, now. Creators always can. */
function mayWrite(room: Room, sender: string | undefined, type: string): boolean {
  if (!sender) return false;
  if (getRoomCreators(room).has(sender)) return true;
  const content = roomStateMaybe(room)?.getStateEvents('m.room.power_levels', '')?.getContent() as
    | {
        users?: Record<string, number>;
        users_default?: number;
        events?: Record<string, number>;
        state_default?: number;
      }
    | undefined;
  const level = content?.users?.[sender] ?? content?.users_default ?? 0;
  const needed = content?.events?.[type] ?? content?.state_default ?? 50;
  return level >= Math.max(needed, MIN_WRITER_LEVEL);
}

function readRoles(room: Room): SpaceRole[] {
  const event = roomStateMaybe(room)?.getStateEvents(SPACE_ROLES_STATE_TYPE, '');
  if (!event || !mayWrite(room, event.getSender(), SPACE_ROLES_STATE_TYPE)) return [];
  const list = (event.getContent() as { roles?: unknown }).roles;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const roles: SpaceRole[] = [];
  for (const raw of list) {
    const role = sanitizeRole(raw);
    if (!role || seen.has(role.id)) continue;
    seen.add(role.id);
    roles.push(role);
    if (roles.length >= MAX_ROLES) break;
  }
  return roles;
}

function readBuiltin(room: Room): BuiltinRoleLooks {
  const event = roomStateMaybe(room)?.getStateEvents(SPACE_ROLES_STATE_TYPE, '');
  if (!event || !mayWrite(room, event.getSender(), SPACE_ROLES_STATE_TYPE)) return {};
  const raw = (event.getContent() as { builtin?: unknown }).builtin;
  const looks: BuiltinRoleLooks = {};
  if (!raw || typeof raw !== 'object') return looks;
  for (const key of BUILTIN_ROLE_KEYS) {
    const entry = (raw as Record<string, unknown>)[key];
    if (!entry || typeof entry !== 'object') continue;
    const { name, color } = entry as Record<string, unknown>;
    const look: BuiltinRoleLook = {};
    const clean = cleanRoleName(name);
    if (clean) look.name = clean;
    if (isValidRoleColor(color)) look.color = color.toLowerCase();
    if (look.name || look.color) looks[key] = look;
  }
  return looks;
}

function readAssignments(room: Room, roles: SpaceRole[]): Map<string, SpaceRole[]> {
  const byUser = new Map<string, SpaceRole[]>();
  if (roles.length === 0) return byUser;
  const order = new Map(roles.map((role, i) => [role.id, i]));
  const events = roomStateMaybe(room)?.getStateEvents(SPACE_MEMBER_ROLES_STATE_TYPE) ?? [];
  for (const event of events as MatrixEvent[]) {
    const key = event.getStateKey();
    const userId = key ? `@${key}` : undefined;
    if (!userId || !mayWrite(room, event.getSender(), SPACE_MEMBER_ROLES_STATE_TYPE)) continue;
    const ids = (event.getContent() as { roles?: unknown }).roles;
    if (!Array.isArray(ids)) continue;
    const held = new Set<number>();
    for (const id of ids.slice(0, MAX_ROLES_PER_MEMBER)) {
      const at = typeof id === 'string' ? order.get(id) : undefined;
      if (at !== undefined) held.add(at);
    }
    if (held.size > 0)
      byUser.set(
        userId,
        [...held].sort((a, b) => a - b).map((i) => roles[i])
      );
  }
  return byUser;
}

// --- a shared, cached view that follows the state --------------------------------------------

/**
 * Bumped only when something roles depend on changes: the role events, the list style, power
 * levels, which rooms a space holds, and which spaces you are in. Each message and member row
 * re-renders on a bump, so a plain sync must never cause one.
 */
let version = 0;
let attachedTo: MatrixClient | null = null;
const listeners = new Set<() => void>();
const computed = new Map<string, { version: number; value: SpaceRoles }>();
const roleSpaceCache = new Map<string, string | null>();
let roleSpaceVersion = -1;
/** Room id → the first joined space that lists it, rebuilt once per version when needed. */
let parentIndex: Map<string, string> | null = null;
let parentIndexVersion = -1;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
/** Many changes arrive together (a sync, a space's whole state): listeners hear about them once. */
const NOTIFY_DELAY_MS = 50;
const EMPTY: SpaceRoles = { builtin: {}, roles: [], byUser: new Map() };

const RELEVANT_STATE = new Set<string>([
  SPACE_ROLES_STATE_TYPE,
  SPACE_MEMBER_ROLES_STATE_TYPE,
  SPACE_LIST_STYLE_STATE_TYPE,
  // power levels decide whether role events count, and which built-in role someone is in
  'm.room.power_levels',
  // space children and parents decide which space a room is in; the create event, whether it is one
  'm.space.child',
  'm.space.parent',
  'm.room.create',
]);

function bump() {
  version += 1;
  if (notifyTimer !== null) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    listeners.forEach((fn) => fn());
  }, NOTIFY_DELAY_MS);
}

function onStateEvent(event: MatrixEvent, _state: unknown, prev: MatrixEvent | null) {
  if (!RELEVANT_STATE.has(event.getType())) return;
  // The same event again (a timeline reset re-applies the state) changes nothing.
  if (prev && prev.getId() && prev.getId() === event.getId()) return;
  bump();
}

/** A new room, or joining or leaving one, can change which space a room is in. */
function onRoomsChanged() {
  bump();
}

function attach(client: MatrixClient) {
  if (attachedTo === client) return;
  attachedTo?.off(RoomStateEvent.Events, onStateEvent);
  attachedTo?.off(ClientEvent.Room, onRoomsChanged);
  attachedTo?.off(RoomEvent.MyMembership, onRoomsChanged);
  attachedTo = client;
  computed.clear();
  roleSpaceCache.clear();
  parentIndex = null;
  client.on(RoomStateEvent.Events, onStateEvent);
  client.on(ClientEvent.Room, onRoomsChanged);
  client.on(RoomEvent.MyMembership, onRoomsChanged);
}

function sameRole(a: SpaceRole | undefined, b: SpaceRole | undefined): boolean {
  return (
    !!a && !!b && a.id === b.id && a.name === b.name && a.color === b.color && a.hoist === b.hoist
  );
}

function sameRoleList(a: SpaceRole[], b: SpaceRole[]): boolean {
  return a.length === b.length && a.every((role, i) => sameRole(role, b[i]));
}

function sameBuiltin(a: BuiltinRoleLooks, b: BuiltinRoleLooks): boolean {
  return BUILTIN_ROLE_KEYS.every(
    (key) => a[key]?.name === b[key]?.name && a[key]?.color === b[key]?.color
  );
}

function sameByUser(a: Map<string, SpaceRole[]>, b: Map<string, SpaceRole[]>): boolean {
  if (a.size !== b.size) return false;
  for (const [userId, held] of a) {
    const other = b.get(userId);
    if (!other || !sameRoleList(held, other)) return false;
  }
  return true;
}

/**
 * The previous value's parts are kept wherever they did not change, so callers (and anything
 * memoised on them) see the same objects until the roles really change.
 */
function reuse(prev: SpaceRoles | undefined, next: SpaceRoles): SpaceRoles {
  if (!prev) return next;
  const roles = sameRoleList(prev.roles, next.roles) ? prev.roles : next.roles;
  const builtin = sameBuiltin(prev.builtin, next.builtin) ? prev.builtin : next.builtin;
  const byUser = sameByUser(prev.byUser, next.byUser) ? prev.byUser : next.byUser;
  if (roles === prev.roles && builtin === prev.builtin && byUser === prev.byUser) return prev;
  return { builtin, roles, byUser };
}

/** The joined space a room is listed in (the first one, as `findParentSpaceId` picks). */
function parentSpaceOf(client: MatrixClient, roomId: string): string | null {
  if (!parentIndex || parentIndexVersion !== version) {
    parentIndex = new Map();
    parentIndexVersion = version;
    for (const space of client.getRooms()) {
      if (!space.isSpaceRoom() || space.getMyMembership() !== 'join') continue;
      const children = roomStateMaybe(space)?.getStateEvents('m.space.child') ?? [];
      for (const child of children) {
        const childId = child.getStateKey();
        if (childId && isActiveSpaceChild(child) && !parentIndex.has(childId)) {
          parentIndex.set(childId, space.roomId);
        }
      }
    }
  }
  return parentIndex.get(roomId) ?? null;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getVersion = () => version;

export function readSpaceRoles(client: MatrixClient, spaceId: string): SpaceRoles {
  attach(client);
  const cached = computed.get(spaceId);
  if (cached && cached.version === version) return cached.value;
  const room = client.getRoom(spaceId);
  let value = EMPTY;
  if (room && readSpaceListStyle(client, spaceId) === 'modern') {
    const roles = readRoles(room);
    value = reuse(cached?.value, {
      builtin: readBuiltin(room),
      roles,
      byUser: readAssignments(room, roles),
    });
  }
  computed.set(spaceId, { version, value });
  return value;
}

/**
 * The space a room's roles come from: the nearest space around it (itself, its category, the space
 * above that) that has roles set up. A room in a category uses the roles of the space the category
 * is in.
 */
export function roleSpaceFor(client: MatrixClient, roomId: string): string | null {
  attach(client);
  if (roleSpaceVersion !== version) {
    roleSpaceCache.clear();
    roleSpaceVersion = version;
  }
  const hit = roleSpaceCache.get(roomId);
  if (hit !== undefined) return hit;
  let spaceId: string | null = null;
  let at: string | null = client.getRoom(roomId)?.isSpaceRoom()
    ? roomId
    : parentSpaceOf(client, roomId);
  for (let depth = 0; at && depth < 6; depth++) {
    const found = readSpaceRoles(client, at);
    if (found.roles.length > 0 || Object.keys(found.builtin).length > 0) {
      spaceId = at;
      break;
    }
    at = parentSpaceOf(client, at);
  }
  roleSpaceCache.set(roomId, spaceId);
  return spaceId;
}

/** A person's roles in a space (top of the list first), kept current. */
export function useSpaceMemberRoles(
  client: MatrixClient | null | undefined,
  spaceId: string | null | undefined
): SpaceRoles {
  useSyncExternalStore(subscribe, getVersion);
  return client && spaceId ? readSpaceRoles(client, spaceId) : EMPTY;
}

/** The roles in effect for a room: its own space's, or its parent space's. */
export function useRoomRoles(
  client: MatrixClient | null | undefined,
  roomId: string | null | undefined
): SpaceRoles {
  useSyncExternalStore(subscribe, getVersion);
  if (!client || !roomId) return EMPTY;
  const spaceId = roleSpaceFor(client, roomId);
  return spaceId ? readSpaceRoles(client, spaceId) : EMPTY;
}

/** Which built-in role someone is in this room, from their power level. */
export function builtinKeyOf(room: Room | null | undefined, userId: string): BuiltinRoleKey {
  if (getRoomCreators(room).has(userId)) return 'founder';
  const level = room?.getMember(userId)?.powerLevel ?? 0;
  if (level >= 100) return '100';
  return level >= 50 ? '50' : '0';
}

/**
 * The colour to show for someone: their Admin/Moderator look first, then their own roles from the
 * top of the list, then the plain Member look. Founders fall back to the Admin look.
 */
export function roleColorOf(
  roles: SpaceRoles,
  userId: string,
  builtinKey: BuiltinRoleKey = '0'
): string | undefined {
  let high: string | undefined;
  if (builtinKey === 'founder') high = roles.builtin.founder?.color ?? roles.builtin['100']?.color;
  else if (builtinKey !== '0') high = roles.builtin[builtinKey]?.color;
  return (
    high ?? roles.byUser.get(userId)?.find((role) => role.color)?.color ?? roles.builtin['0']?.color
  );
}

// --- writing ----------------------------------------------------------------------------------

export async function saveSpaceRoles(
  client: MatrixClient,
  spaceId: string,
  roles: SpaceRole[],
  builtin: BuiltinRoleLooks = readSpaceRoles(client, spaceId).builtin
): Promise<void> {
  await client.sendStateEvent(
    spaceId,
    SPACE_ROLES_STATE_TYPE as never,
    { roles: roles.slice(0, MAX_ROLES), builtin } as never,
    ''
  );
}

export async function saveMemberRoles(
  client: MatrixClient,
  spaceId: string,
  userId: string,
  roleIds: string[]
): Promise<void> {
  await client.sendStateEvent(
    spaceId,
    SPACE_MEMBER_ROLES_STATE_TYPE as never,
    { roles: roleIds.slice(0, MAX_ROLES_PER_MEMBER) } as never,
    memberStateKey(userId)
  );
}

/** Member updates sent at once when a role is deleted: enough to be quick, not a flood. */
const DELETE_PARALLEL = 4;

/** Thrown when the role is gone but some people's assignments could not be updated. */
export class RoleCleanupError extends Error {
  readonly failed: string[];
  readonly total: number;
  readonly firstError: unknown;

  constructor(failed: string[], total: number, firstError: unknown) {
    super(`${failed.length} of ${total} member updates failed`);
    this.name = 'RoleCleanupError';
    this.failed = failed;
    this.total = total;
    this.firstError = firstError;
  }
}

/**
 * Removes a role and takes it off everyone who held it. The role list goes first: once the role is
 * gone, a leftover assignment refers to nothing and is ignored, so failures there are only untidy.
 */
export async function deleteSpaceRole(
  client: MatrixClient,
  spaceId: string,
  roleId: string
): Promise<void> {
  const current = readSpaceRoles(client, spaceId);
  await saveSpaceRoles(
    client,
    spaceId,
    current.roles.filter((role) => role.id !== roleId)
  );
  const queue = [...current.byUser].filter(([, held]) => held.some((role) => role.id === roleId));
  const total = queue.length;
  const failed: string[] = [];
  let firstError: unknown;
  await Promise.all(
    Array.from({ length: Math.min(DELETE_PARALLEL, total) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [userId, held] = next;
        try {
          await saveMemberRoles(
            client,
            spaceId,
            userId,
            held.filter((role) => role.id !== roleId).map((role) => role.id)
          );
        } catch (err) {
          failed.push(userId);
          firstError ??= err;
        }
      }
    })
  );
  if (failed.length > 0) throw new RoleCleanupError(failed, total, firstError);
}

/** Whether you may create and assign roles in this space. */
export function canManageRoles(client: MatrixClient, spaceId: string): boolean {
  const room = client.getRoom(spaceId);
  const me = client.getUserId();
  if (!room || !me) return false;
  return (
    mayWrite(room, me, SPACE_ROLES_STATE_TYPE) && mayWrite(room, me, SPACE_MEMBER_ROLES_STATE_TYPE)
  );
}
