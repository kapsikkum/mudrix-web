import { EventType } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { formatUserId } from '@/util/matrix';

export const CALL_MEMBER_EVENT_TYPES: ReadonlySet<string> = new Set([
  EventType.GroupCallMemberPrefix,
  EventType.RTCMembership,
]);

const CALL_SESSION_GAP_MS = 10 * 60 * 1000;

export interface CallSessionParticipant {
  userId: string;
  name: string;
  mxcAvatar: string | null;
  joinedTs: number;
}

export interface CallSessionSummary {
  events: MatrixEvent[];
  startTs: number;
  endTs: number | null;
  participants: CallSessionParticipant[];
  isPartial: boolean;
  version: string;
}

function isCallMemberEvent(event: MatrixEvent): boolean {
  return CALL_MEMBER_EVENT_TYPES.has(event.getType());
}

function isCallJoinEvent(event: MatrixEvent): boolean {
  if (!isCallMemberEvent(event)) return false;
  const content = event.getContent() as Record<string, unknown> | null;
  return Boolean(content?.application);
}

export function isRedundantJoin(event: MatrixEvent): boolean {
  if (!isCallJoinEvent(event)) return false;
  const prevContent = event.getPrevContent() as Record<string, unknown> | null | undefined;
  return !!prevContent && 'application' in prevContent;
}

function getParticipant(
  room: Room | null,
  userId: string,
  joinedTs: number
): CallSessionParticipant {
  const member = room?.getMember(userId);
  return {
    userId,
    name: member?.name ?? formatUserId(userId),
    mxcAvatar: member?.getMxcAvatarUrl() ?? null,
    joinedTs,
  };
}

function dayKey(ts: number): number {
  const date = new Date(ts);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

interface SessionState {
  events: MatrixEvent[];
  openUsers: Set<string>;
  participants: CallSessionParticipant[];
  participantIds: Set<string>;
  startTs: number;
  lastActivityTs: number;
  endedTs: number | null;
  closing: boolean;
  isPartial: boolean;
  sawJoin: boolean;
}

function emptyState(): SessionState {
  return {
    events: [],
    openUsers: new Set(),
    participants: [],
    participantIds: new Set(),
    startTs: 0,
    lastActivityTs: 0,
    endedTs: null,
    closing: false,
    isPartial: false,
    sawJoin: false,
  };
}

export function buildCallSessions(
  events: MatrixEvent[],
  room: Room | null
): Map<string, CallSessionSummary> {
  const sessions = new Map<string, CallSessionSummary>();
  let state = emptyState();

  const emit = (finalise: (s: SessionState) => void): void => {
    const first = state.events[0];
    if (!first) {
      state = emptyState();
      return;
    }
    finalise(state);
    const key = first.getId();
    if (key) {
      sessions.set(key, {
        events: state.events,
        startTs: state.startTs,
        endTs: state.endedTs,
        participants: state.participants,
        isPartial: state.isPartial,
        version: `${state.endedTs ?? 'live'}|${state.isPartial}|${state.participants
          .map((p) => p.userId)
          .join(',')}`,
      });
    }
    state = emptyState();
  };

  const closeUnchanged = (s: SessionState): void => {
    if (s.endedTs === null) s.endedTs = s.lastActivityTs;
  };

  const closeLive = (s: SessionState): void => {
    if (s.endedTs === null && Date.now() - s.lastActivityTs >= CALL_SESSION_GAP_MS) {
      s.endedTs = s.lastActivityTs;
    }
  };

  for (const event of events) {
    if (!isCallMemberEvent(event)) continue;
    if (isRedundantJoin(event)) continue;

    const sender = event.getSender() ?? '';
    const ts = event.getTs();
    const joined = isCallJoinEvent(event);
    const knownUser = state.participantIds.has(sender);

    const gap = state.events.length > 0 ? ts - state.lastActivityTs : 0;
    const dayChanged = state.events.length > 0 && dayKey(ts) !== dayKey(state.startTs);

    let continues: boolean;
    if (state.events.length === 0) {
      continues = false;
    } else if (dayChanged || gap >= CALL_SESSION_GAP_MS) {
      continues = false;
    } else if (state.closing) {
      continues = !joined && knownUser;
    } else {
      continues = true;
    }

    if (!continues) {
      if (state.events.length > 0) emit(closeUnchanged);
    }

    if (state.events.length === 0) {
      state.startTs = ts;
      state.isPartial = !joined;
    }

    state.events.push(event);
    state.lastActivityTs = ts;

    if (!joined) {
      state.openUsers.delete(sender);
      if (state.closing) {
        state.endedTs = ts;
      } else if (state.sawJoin && state.openUsers.size === 0) {
        state.endedTs = ts;
        state.closing = true;
      }
    } else {
      state.sawJoin = true;
      state.openUsers.add(sender);
      if (!state.participantIds.has(sender)) {
        state.participantIds.add(sender);
        state.participants.push(getParticipant(room, sender, ts));
      }
    }
  }

  emit(closeLive);
  return sessions;
}
