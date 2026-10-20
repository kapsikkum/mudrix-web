import { useState, useEffect, useRef, useCallback } from 'react';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  PushPinIcon,
  XIcon,
  PhoneIcon,
  HashStraightIcon,
  SpeakerHighIcon,
  UsersIcon,
  ChatDotsIcon,
  CalendarBlankIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { Tooltip } from '@/app/components/Tooltip';
import {
  membersPanelOpenAtom,
  roomSettingsRoomIdAtom,
  roomSettingsTabAtom,
  threadsPanelViewAtom,
} from '@/app/store/atoms';
import { useRoomEncrypted } from '@/app/hooks/useRoomEncryption';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { useHasUnreadThreads } from '@/app/hooks/useHasUnreadThreads';
import { formatUserId, isVoiceRoom, roomState, roomStateMaybe } from '@/util/matrix';
import { JumpToDateModal } from './JumpToDateModal';
import * as css from './RoomHeader.css';

function usePinnedMessages(client: MatrixClient, roomId: string) {
  const room = client.getRoom(roomId);

  const getPinned = useCallback((): MatrixEvent[] => {
    if (!room) return [];
    const stateEvent = roomState(room).getStateEvents('m.room.pinned_events', '');
    const event = Array.isArray(stateEvent) ? stateEvent[0] : stateEvent;
    const content = event?.getContent() as { pinned?: string[] } | undefined;
    const ids: string[] = content?.pinned ?? [];
    const events: MatrixEvent[] = [];
    for (const id of ids) {
      const ev = room.findEventById(id);
      if (ev) events.push(ev);
    }
    return events;
  }, [room]);

  const [pinned, setPinned] = useState<MatrixEvent[]>(getPinned);

  const refresh = useCallback(() => setPinned(getPinned()), [getPinned]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useMatrixEvent(client, 'RoomState.events', refresh);

  return pinned;
}

interface PinnedPanelProps {
  client: MatrixClient;
  roomId: string;
  onJumpTo: (eventId: string) => void;
  onClose: () => void;
}

function PinnedPanel({ client, roomId, onJumpTo, onClose }: PinnedPanelProps) {
  const { t } = useTranslation();
  const pinned = usePinnedMessages(client, roomId);

  return (
    <div className={css.pinnedPanel}>
      <div className={css.pinnedPanelHeader}>
        <span className={css.pinnedPanelTitle}>
          <PushPinIcon size={14} />
          {t('room.header.pinnedMessages')}
          {pinned.length > 0 && ` (${pinned.length})`}
        </span>
        <button
          type="button"
          className={css.headerBtn}
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <XIcon size={16} />
        </button>
      </div>

      {pinned.length === 0 ? (
        <div className={css.pinnedEmpty}>{t('room.header.noPinnedMessages')}</div>
      ) : (
        [...pinned].reverse().map((ev) => {
          const room = client.getRoom(roomId);
          const senderId = ev.getSender() ?? '';
          const member = room?.getMember(senderId);
          const senderName = member?.name ?? formatUserId(senderId);
          const content = ev.getContent();
          const body: string = ev.isDecryptionFailure()
            ? t('timeline.couldNotDecrypt')
            : ev.isRedacted()
              ? '(deleted)'
              : ((content?.body as string) ?? '(media)');

          return (
            <div
              key={ev.getId()}
              className={css.pinnedItem}
              role="button"
              tabIndex={0}
              onClick={() => {
                onJumpTo(ev.getId() ?? '');
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onJumpTo(ev.getId() ?? '');
                  onClose();
                }
              }}
            >
              <PushPinIcon size={12} className={css.pinnedPin} />
              <div className={css.pinnedContent}>
                <div className={css.pinnedSender}>{senderName}</div>
                <div className={css.pinnedBody} title={body}>
                  {body}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

interface RoomHeaderProps {
  client: MatrixClient;
  roomId: string;
  onJumpToEvent?: (eventId: string) => void;
  onStartCall?: (roomId: string) => void;
  callActive?: boolean;
  othersInCall?: boolean;
}

export function RoomHeader({
  client,
  roomId,
  onJumpToEvent,
  onStartCall,
  callActive = false,
  othersInCall = false,
}: RoomHeaderProps) {
  const { t } = useTranslation();
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const setThreadsPanelView = useSetAtom(threadsPanelViewAtom);
  const membersPanelOpen = useAtomValue(membersPanelOpenAtom);
  const threadsPanelView = useAtomValue(threadsPanelViewAtom);
  const hasUnreadThreads = useHasUnreadThreads(roomId);
  const room = client.getRoom(roomId);
  const encrypted = useRoomEncrypted(client, roomId);
  const setRoomSettingsId = useSetAtom(roomSettingsRoomIdAtom);
  const setRoomSettingsTab = useSetAtom(roomSettingsTabAtom);
  const [showPinned, setShowPinned] = useState(false);
  const [showTopic, setShowTopic] = useState(false);
  const [showJumpToDate, setShowJumpToDate] = useState(false);
  // Calls are available in any joined room (DM or group) that isn't a space.
  const can = useCanSendState(room);
  const canJoinCall = can(EventType.GroupCallMemberPrefix);
  const callSupported = (() => {
    if (!room) return false;
    if (room.isSpaceRoom()) return false;
    return room.getMyMembership() === 'join';
  })();
  // Voice rooms are joined from the sidebar, so the header button is not an entry point there.
  const isVoice = isVoiceRoom(room);
  const callLive = callActive || othersInCall;
  const callDisabled = callActive || isVoice || !canJoinCall;
  const callLabel = isVoice
    ? t('room.joinVoice')
    : callActive
      ? t('voice.callActive')
      : othersInCall
        ? t('voice.joinCall')
        : t('voice.startCall');
  const hasLeftHeaderActions =
    (callSupported && onStartCall !== undefined) || onJumpToEvent !== undefined;

  // Close pinned panel on outside click
  const panelRef = useRef<HTMLDivElement>(null);
  const pinnedBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showPinned) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        pinnedBtnRef.current &&
        !pinnedBtnRef.current.contains(target)
      ) {
        setShowPinned(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPinned]);

  const topicPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showTopic) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      const target = e.target as Node;
      if (e.type === 'keydown') {
        if ((e as KeyboardEvent).key === 'Escape') setShowTopic(false);
        return;
      }
      if (
        topicPanelRef.current &&
        !topicPanelRef.current.contains(target) &&
        !(target instanceof Element && target.closest('[data-topic-trigger]'))
      ) {
        setShowTopic(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [showTopic]);

  useEffect(() => {
    setShowTopic(false);
  }, [roomId]);

  const roomName = room?.name ?? roomId;
  const topic =
    roomStateMaybe(room)
      ?.getStateEvents('m.room.topic', '')
      ?.getContent<{ topic?: string }>()
      ?.topic?.trim() ?? '';

  return (
    <div className={css.headerWrapper}>
      {/* Main header bar */}
      <div className={css.header}>
        <div className={css.nameContainer}>
          <div className={css.nameRow}>
            {isVoice ? (
              <SpeakerHighIcon size={16} className={css.roomIcon} weight="fill" />
            ) : (
              <HashStraightIcon size={16} className={css.roomIcon} />
            )}
            <Tooltip content={roomId}>
              <h1 className={css.roomName}>{roomName}</h1>
            </Tooltip>
            {room && !room.isSpaceRoom() && (
              <Tooltip
                content={encrypted ? t('encryption.encrypted') : t('encryption.notEncrypted')}
              >
                <button
                  type="button"
                  className={encrypted ? css.encryptionBtn : css.encryptionBtnOff}
                  aria-label={encrypted ? t('encryption.encrypted') : t('encryption.notEncrypted')}
                  onClick={() => {
                    // The encryption status and the enable-encryption switch live in the
                    // Security & Privacy section of the General tab.
                    setRoomSettingsTab('general');
                    setRoomSettingsId(roomId);
                  }}
                >
                  {encrypted ? (
                    <LockSimpleIcon size={14} weight="fill" />
                  ) : (
                    <LockSimpleOpenIcon size={14} />
                  )}
                </button>
              </Tooltip>
            )}
          </div>
          {topic && (
            <>
              <span className={css.topicDivider} />
              <button
                type="button"
                className={css.topicTrigger}
                data-topic-trigger="true"
                aria-expanded={showTopic}
                onClick={() => {
                  setShowTopic((v) => !v);
                  setShowPinned(false);
                }}
              >
                {topic}
              </button>
            </>
          )}
        </div>

        {/* Call button — available in DM and group rooms */}
        {callSupported && onStartCall && (
          <Tooltip content={callLabel}>
            <button
              type="button"
              className={callLive ? css.headerBtnActive : css.headerBtn}
              aria-label={callLabel}
              onClick={() => onStartCall(roomId)}
              disabled={callDisabled}
            >
              <PhoneIcon size={16} weight={callLive ? 'fill' : 'regular'} />
            </button>
          </Tooltip>
        )}

        {/* Pinned button */}
        {onJumpToEvent && (
          <Tooltip content={t('room.header.pinnedMessages')}>
            <button
              type="button"
              ref={pinnedBtnRef}
              className={showPinned ? css.headerBtnActive : css.headerBtn}
              aria-label={t('room.header.pinnedMessages')}
              onClick={() => {
                setShowPinned((v) => !v);
                setShowTopic(false);
              }}
            >
              <PushPinIcon size={16} weight={showPinned ? 'fill' : 'regular'} />
            </button>
          </Tooltip>
        )}

        {/* Jump to date button */}
        {onJumpToEvent && (
          <Tooltip content={t('room.jumpToDate.title')}>
            <button
              type="button"
              className={css.headerBtn}
              aria-label={t('room.jumpToDate.title')}
              onClick={() => {
                setShowJumpToDate(true);
                setShowPinned(false);
                setShowTopic(false);
              }}
            >
              <CalendarBlankIcon size={16} />
            </button>
          </Tooltip>
        )}

        <div className={css.desktopOnly}>
          {hasLeftHeaderActions && <div className={css.headerDivider} />}

          {/* Threads toggle button */}
          <Tooltip content={t('timeline.threads')}>
            <button
              type="button"
              className={threadsPanelView ? css.headerBtnActive : css.headerBtn}
              aria-label={t('timeline.threads')}
              onClick={() => setThreadsPanelView((prev) => (prev ? null : { type: 'list' }))}
            >
              <span className={css.headerThreadIconWrap}>
                <ChatDotsIcon size={16} weight={threadsPanelView ? 'fill' : 'regular'} />
                {hasUnreadThreads && <span className={css.headerThreadDot} />}
              </span>
            </button>
          </Tooltip>

          {/* Members toggle button */}
          <Tooltip content={t('common.members')}>
            <button
              type="button"
              className={membersPanelOpen ? css.headerBtnActive : css.headerBtn}
              aria-label={t('common.members')}
              onClick={() => toggleMembersPanel((v) => !v)}
            >
              <UsersIcon size={16} weight={membersPanelOpen ? 'fill' : 'regular'} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Pinned panel */}
      {showPinned && onJumpToEvent && (
        <div ref={panelRef}>
          <PinnedPanel
            client={client}
            roomId={roomId}
            onJumpTo={onJumpToEvent}
            onClose={() => setShowPinned(false)}
          />
        </div>
      )}

      {onJumpToEvent && (
        <JumpToDateModal
          open={showJumpToDate}
          onClose={() => setShowJumpToDate(false)}
          client={client}
          roomId={roomId}
          onJump={onJumpToEvent}
        />
      )}

      {showTopic && (
        <div ref={topicPanelRef}>
          <div className={css.topicPanel}>
            <p className={css.topicPanelText}>{topic}</p>
          </div>
        </div>
      )}
    </div>
  );
}
