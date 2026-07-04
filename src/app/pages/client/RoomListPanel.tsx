import { useCallback, useState, useRef } from 'react';
import { PlusIcon, StackIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tooltip } from '@/app/components/Tooltip';
import { IconButton, Button } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  currentSpaceIdAtom,
  sidebarViewAtom,
  createRoomOpenAtom,
  newDmOpenAtom,
  voiceStateAtom,
  callStateAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { useDms } from '@/app/hooks/useDms';
import { useRooms } from '@/app/features/room';
import { VoiceBar } from '@/app/features/voice/VoiceBar';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import { RoomListItem, DmListItem } from './RoomListItem';
import { UserPanel } from './UserPanel';
import * as css from './RoomListPanel.css';

import { roomStateMaybe } from '@/util/matrix';

const ROOM_ITEM_HEIGHT = 48;
const LIST_OVERSCAN = 5;

interface RoomListPanelProps {
  onVoiceLeave: () => void;
  onVoiceToggleMute: () => void;
  onVoiceToggleVideo: () => void;
  onVoiceJoin: (roomId: string, domain: string) => void;
}

export function RoomListPanel({
  onVoiceLeave,
  onVoiceToggleMute,
  onVoiceToggleVideo,
  onVoiceJoin,
}: RoomListPanelProps) {
  const { t } = useTranslation();
  const [currentRoomId, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const [currentSpaceId] = useAtom(currentSpaceIdAtom);
  const [sidebarView] = useAtom(sidebarViewAtom);
  const [, setCreateRoomOpen] = useAtom(createRoomOpenAtom);
  const [, setNewDmOpen] = useAtom(newDmOpenAtom);
  const voiceState = useAtomValue(voiceStateAtom);
  const callState = useAtomValue(callStateAtom);
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const isDmView = sidebarView === 'dms';

  const { rooms, loading } = useRooms(isDmView ? null : currentSpaceId);
  const dms = useDms(client);

  const roomListRef = useRef<HTMLDivElement>(null);

  const roomVirtualizer = useVirtualizer({
    count: rooms.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: () => ROOM_ITEM_HEIGHT,
    overscan: LIST_OVERSCAN,
    enabled: !isDmView,
  });

  const dmVirtualizer = useVirtualizer({
    count: dms.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: () => ROOM_ITEM_HEIGHT,
    overscan: LIST_OVERSCAN,
    enabled: isDmView,
  });

  const selectRoom = useCallback(
    (roomId: string, isDm = false) => {
      setCurrentRoomId(roomId);
      navigate(`/${isDm ? 'dm' : 'r'}/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
    },
    [setCurrentRoomId, navigate, sidebarView, currentSpaceId]
  );

  const handleHeaderAction = useCallback(() => {
    if (isDmView) {
      setNewDmOpen(true);
    } else {
      const spaceName = currentSpaceId ? (client?.getRoom(currentSpaceId)?.name ?? null) : null;
      setCreateRoomOpen({ open: true, spaceId: currentSpaceId, spaceName });
    }
  }, [isDmView, setNewDmOpen, currentSpaceId, client, setCreateRoomOpen]);

  // Space invite state
  const currentSpace = currentSpaceId && client ? client.getRoom(currentSpaceId) : null;
  const isSpaceInvite = currentSpace?.getMyMembership() === 'invite';
  const [inviteLoading, setInviteLoading] = useState(false);

  const spaceInviterEvent = roomStateMaybe(currentSpace)?.getStateEvents(
    'm.room.member',
    client?.getUserId() ?? ''
  );
  const spaceInviterId = spaceInviterEvent?.getSender() ?? null;
  const spaceInviterUser = spaceInviterId ? client?.getUser(spaceInviterId) : null;
  const spaceInviterName =
    spaceInviterUser?.displayName ?? spaceInviterId ?? t('invite.unknownInviter');

  const handleSpaceAccept = useCallback(async () => {
    if (!client || !currentSpaceId) return;
    setInviteLoading(true);
    try {
      await client.joinRoom(currentSpaceId);
    } catch (err) {
      toast.error(t('invite.acceptFailed', { error: getErrorMessage(err) }));
    } finally {
      setInviteLoading(false);
    }
  }, [client, currentSpaceId, toast, t]);

  const handleSpaceDecline = useCallback(async () => {
    if (!client || !currentSpaceId || !currentSpace) return;
    setInviteLoading(true);
    try {
      await client.leave(currentSpaceId);
      toast.info(t('invite.declined', { name: currentSpace.name }));
    } catch (err) {
      toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
    } finally {
      setInviteLoading(false);
    }
  }, [client, currentSpaceId, currentSpace, toast, t]);

  const headerLabel =
    sidebarView === 'dms'
      ? t('room.dm.directMessages')
      : currentSpaceId
        ? (client?.getRoom(currentSpaceId)?.name ?? t('room.home'))
        : t('room.home');
  const showSpaceIcon = sidebarView !== 'dms' && !!currentSpaceId;

  return (
    <div className={css.roomListPanel}>
      <div className={css.roomHeader}>
        <Tooltip content={headerLabel}>
          <span className={css.roomHeaderTitle}>
            {showSpaceIcon && <StackIcon size={14} className={css.roomHeaderIcon} />}
            <span className={css.roomHeaderLabel}>{headerLabel}</span>
          </span>
        </Tooltip>
        <div className={css.roomHeaderActions}>
          <IconButton
            size="sm"
            tooltip={isDmView ? t('room.dm.newDm') : t('room.create.title')}
            aria-label={isDmView ? t('room.dm.newDmShort') : t('room.create.titleShort')}
            onClick={handleHeaderAction}
          >
            <PlusIcon size={16} />
          </IconButton>
        </div>
      </div>

      {isSpaceInvite && currentSpace ? (
        <div className={css.spaceInviteBanner}>
          <Avatar
            name={currentSpace.name}
            mxcUrl={currentSpace.getMxcAvatarUrl?.() ?? null}
            client={client ?? undefined}
            size="xl"
          />
          <span className={css.spaceInviteName}>{currentSpace.name}</span>
          <span className={css.spaceInviteBy}>
            {t('invite.invitedBy', { name: spaceInviterName })}
          </span>
          <div className={css.spaceInviteActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSpaceDecline}
              disabled={inviteLoading}
            >
              {t('invite.decline')}
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleSpaceAccept}
              disabled={inviteLoading}
            >
              {t('invite.accept')}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={roomListRef}
        className={css.roomList}
        style={isSpaceInvite ? { display: 'none' } : undefined}
      >
        {isDmView ? (
          dms.length === 0 ? (
            <div className={css.emptyList}>{t('room.noDms')}</div>
          ) : (
            <div style={{ height: dmVirtualizer.getTotalSize(), position: 'relative' }}>
              {dmVirtualizer.getVirtualItems().map((virtualRow) => {
                const entry = dms[virtualRow.index];
                return (
                  <div
                    key={entry.roomId}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <DmListItem
                      entry={entry}
                      isActive={currentRoomId === entry.roomId}
                      onSelect={selectRoom}
                    />
                  </div>
                );
              })}
            </div>
          )
        ) : loading && rooms.length === 0 ? (
          <div className={css.skeletonList}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={css.skeletonRow}>
                <div className={css.skeletonAvatar} />
                <div className={css.skeletonLines}>
                  <div className={css.skeletonLine} />
                  <div className={css.skeletonLineShort} />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className={css.emptyList}>{t('room.noRooms')}</div>
        ) : (
          <div style={{ height: roomVirtualizer.getTotalSize(), position: 'relative' }}>
            {roomVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = rooms[virtualRow.index];
              return (
                <div
                  key={entry.roomId}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <RoomListItem
                    entry={entry}
                    isActive={currentRoomId === entry.roomId}
                    onSelect={selectRoom}
                    onVoiceJoin={onVoiceJoin}
                    isInVoiceCall={voiceState.roomId === entry.roomId}
                    isVoiceReady={voiceState.roomId === entry.roomId && voiceState.ready}
                    voiceBusy={voiceState.roomId !== null}
                    voiceBusyRoomId={voiceState.roomId}
                    voiceBusyRoomName={voiceState.roomName}
                    callActive={callState.active}
                    callIncoming={callState.incoming}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voice bar — above UserPanel, self-hides when not in a call */}
      <VoiceBar
        onLeave={onVoiceLeave}
        onToggleMute={onVoiceToggleMute}
        onToggleVideo={onVoiceToggleVideo}
      />

      <UserPanel />
    </div>
  );
}
