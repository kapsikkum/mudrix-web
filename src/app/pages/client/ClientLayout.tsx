import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  currentSpaceIdAtom,
  currentRoomIdAtom,
  sidebarViewAtom,
  mobileDrawerOpenAtom,
  settingsOpenAtom,
  settingsPageAtom,
  globalSearchOpenAtom,
  createSpaceOpenAtom,
  inboxOpenAtom,
  membersPanelOpenAtom,
  spaceMembersPanelOpenAtom,
  threadsPanelViewAtom,
  threadPanelExpandedAtom,
  roomChatPanelOpenAtom,
  roomChatRoomIdAtom,
  closeRoomChatAtom,
  isInCallAtom,
  callActionsAtom,
  callRoomIdAtom,
  callEffectiveViewAtom,
} from '@/app/store/atoms';
import { commandActionsAtom } from '@/app/store/atoms/call';
import type { CallPresentation, SidebarView } from '@/app/store/atoms';
import { useSyncListener, useSyncReady } from '@/app/hooks/useSync';
import { useMatrixToLinks } from '@/app/hooks/useMatrixToLinks';
import { useSettingsSync } from '@/app/hooks/useSettingsSync';
import { useGifFavouritesSync } from '@/app/hooks/useGifFavouritesSync';
import { useDesktopDeviceName } from '@/app/hooks/useDesktopDeviceName';
import { useEnsureMudrixUserFlag, useProfileLiveSync } from '@/app/hooks/useExtendedProfile';
import { useEncryptionSetupWarning } from '@/app/hooks/useEncryptionSetupWarning';
import { useQrImportNotice } from '@/app/hooks/useQrImportNotice';
import { useAutoKeyBackupRestore } from '@/app/hooks/useAutoKeyBackupRestore';
import { useVerification } from '@/app/hooks/useVerification';
import { isEditableTarget, isModOnly } from '@/app/features/keyboardShortcuts/keyEvents';
import { useVoiceKeybinds } from '@/app/hooks/useKeybinds';
import { getMatrixClientOrNull, logout } from '@/client/initMatrix';
import { isChildOfSpace, findParentSpaceId, isVoiceRoom } from '@/util/matrix';
import { STORAGE_KEY_ACCOUNTS } from '@/const/storageKeys';
import type { AccountsMap } from '@/client/accounts';
import { Timeline } from '@/app/features/timeline';
import { TitleBar, TitleBarSearch } from '@/app/components/TitleBar';
import { Inbox } from '@/app/features/inbox';
import { useSwipePanels, SWIPE_PANEL_LEFT, SWIPE_PANEL_RIGHT } from '@/app/hooks/useSwipePanels';
import { useBackToClose } from '@/app/hooks/useBackToClose';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { AccountSwitchGuard } from '@/app/components/AccountSwitchGuard';
import { ConnectionBanner } from '@/app/components/ConnectionBanner';
import { ElementCallLayer } from '@/app/features/calls/ElementCallLayer';
import { useJoinVoiceRoom } from '@/app/features/calls/useJoinVoiceRoom';
import { useVoiceMoves } from '@/app/features/voice/useVoiceMoves';
import { CallContainerProvider, CallContainer } from '@/app/features/calls/CallContainer';
import { CallController } from '@/app/features/calls/CallController';
import { WatchTogetherController } from '@/app/features/calls/watchTogether/WatchTogetherController';
import { useTranslation } from 'react-i18next';
import { useClientNotifications } from './hooks/useClientNotifications';
import { useMediaDeviceSettings } from './hooks/useMediaDeviceSettings';
import { useHydrateAuthImages } from '@/app/hooks/useHydrateAuthImages';
import { useSlidingSyncSubscription } from '@/app/hooks/useSlidingSyncSubscription';
import { useAutoJoinSpaceRooms } from '@/app/hooks/useAutoJoinSpaceRooms';
import { useRecordLastRoom, useSwitchContext } from './hooks/useContextNavigation';
import { useFaviconBadge } from '@/app/hooks/useFaviconBadge';
import { useDocumentTitle } from '@/app/hooks/useDocumentTitle';
import { registerNotificationServiceWorker } from '@/app/hooks/useNotifications';
import { useUpdateCheck } from '@/app/hooks/useUpdateCheck';
import { usePresenceSender } from '@/app/hooks/usePresenceSender';
import { useActivitySharing } from '@/app/hooks/useActivitySharing';
import { useStreamerMode } from '@/app/hooks/useStreamerMode';
import { useReminderDelivery } from '@/app/hooks/useReminderDelivery';
import { useSpaceNicknameSync } from '@/app/hooks/useSpaceNicknames';
import { useBindFavouriteRooms } from '@/app/hooks/useBindFavouriteRooms';
import { usePresenceListener } from '@/app/hooks/usePresenceListener';
import { UpdateButton } from '@/app/components/UpdateButton/UpdateButton';
import { EncryptionWarningButton } from '@/app/components/EncryptionWarningButton/EncryptionWarningButton';
import { SpacesList } from './SpacesList';
import { RoomListPanel } from './RoomListPanel';
import { MembersSidebar } from './MembersSidebar';
import * as sidebarCss from './MembersSidebar.css';
import * as threadPanelCss from './ThreadPanel.css';
import * as sidePanelCss from './SidePanel.css';
import { ThreadPanel } from './ThreadPanel';
import { ThreadListPanel } from './ThreadListPanel';
import { VoiceRoomChatPanel } from './VoiceRoomChatPanel';
import { VoiceRoomStage } from '@/app/features/calls/VoiceRoomStage';
import { useUnifiedPushSync } from '@/app/hooks/useUnifiedPush';
import { MobileHeader } from './MobileHeader';
import { GlobalModals } from './GlobalModals';
import { SpaceOverview } from './SpaceOverview';
import { ActiveNowPanel } from './ActiveNowPanel';
import { HomeWelcome } from './HomeWelcome';
import { ListIcon } from '@phosphor-icons/react';
import * as css from './ClientLayout.css';

function HomePage() {
  const client = getMatrixClientOrNull();
  return (
    <div className={css.homeLayout}>
      {client && <HomeWelcome client={client} />}
      {client && <ActiveNowPanel client={client} />}
    </div>
  );
}

const RoomPage = memo(function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const client = getMatrixClientOrNull();
  if (!client || !roomId) return null;
  const decodedRoomId = decodeURIComponent(roomId);
  const room = client.getRoom(decodedRoomId);
  if (room?.getMyMembership() === 'invite') return null;
  if (room && isVoiceRoom(room)) {
    return <VoiceRoomStage key={decodedRoomId} client={client} roomId={decodedRoomId} />;
  }
  return <Timeline key={decodedRoomId} client={client} roomId={decodedRoomId} />;
});

function SpaceOverviewPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  if (!spaceId) return null;
  const decodedSpaceId = decodeURIComponent(spaceId);
  return <SpaceOverview spaceId={decodedSpaceId} />;
}

export function ClientLayout() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const [currentSpaceId, setCurrentSpaceId] = useAtom(currentSpaceIdAtom);
  const [sidebarView, setSidebarView] = useAtom(sidebarViewAtom);
  const [drawerOpen, setDrawerOpen] = useAtom(mobileDrawerOpenAtom);

  const currentSpaceIdRef = useRef(currentSpaceId);
  currentSpaceIdRef.current = currentSpaceId;

  const switchContext = useSwitchContext();
  const handleSelectView = useCallback(
    (view: SidebarView, spaceId?: string | null) => {
      const nextSpaceId = spaceId ?? null;
      if (view === sidebarView && (view !== 'space' || nextSpaceId === currentSpaceId)) return;
      switchContext(view, nextSpaceId);
    },
    [sidebarView, currentSpaceId, switchContext]
  );

  const location = useLocation();
  useRecordLastRoom();

  useDocumentTitle();
  // Close the mobile sidebar drawer whenever the route changes, except on Home/DMs/space
  // switches, which keep it open so a room can be picked from the new list
  const keepDrawer = (location.state as { keepDrawer?: boolean } | null)?.keepDrawer === true;
  const keepDrawerRef = useRef(keepDrawer);
  keepDrawerRef.current = keepDrawer;
  useEffect(() => {
    if (!keepDrawerRef.current) setDrawerOpen(false);
  }, [location.pathname, setDrawerOpen]);
  const spaceOverviewMatch = location.pathname.match(/^\/space\/(.+)/);
  const spaceOverviewSpaceId = spaceOverviewMatch
    ? decodeURIComponent(spaceOverviewMatch[1])
    : null;
  const roomMatch = location.pathname.match(/^\/(?:r|dm)\/(.+)/);
  const currentRoomId = roomMatch ? decodeURIComponent(roomMatch[1]) : null;
  const sidebarRoomId = spaceOverviewSpaceId ?? currentRoomId;

  const setCurrentRoomId = useSetAtom(currentRoomIdAtom);

  // Extract stable values from mutable location.state
  const navState = location.state as
    | { sidebarView?: SidebarView; currentSpaceId?: string | null }
    | null
    | undefined;
  const stateSidebar = navState?.sidebarView;
  const stateSpaceId = navState?.currentSpaceId;

  // Sync sidebar/space/room atoms with the current URL
  useLayoutEffect(() => {
    const path = location.pathname;

    const dmMatch = path.match(/^\/dm\/(.+)/);
    if (dmMatch) {
      const roomId = decodeURIComponent(dmMatch[1]);
      setSidebarView(stateSidebar ?? 'dms');
      setCurrentSpaceId(stateSpaceId !== undefined ? stateSpaceId : null);
      setCurrentRoomId(roomId);
      return;
    }

    const spaceMatch = path.match(/^\/space\/(.+)/);
    if (spaceMatch) {
      const spaceId = decodeURIComponent(spaceMatch[1]);
      setSidebarView(stateSidebar ?? 'space');
      setCurrentSpaceId(stateSpaceId ?? spaceId);
      setCurrentRoomId(null);
      return;
    }

    const roomMatch = path.match(/^\/r\/(.+)/);
    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      setCurrentRoomId(roomId);

      if (stateSidebar !== undefined || stateSpaceId !== undefined) {
        if (stateSidebar !== undefined) setSidebarView(stateSidebar);
        if (stateSpaceId !== undefined) setCurrentSpaceId(stateSpaceId);
        return;
      }

      const keepSpaceId = !client
        ? null
        : currentSpaceIdRef.current && isChildOfSpace(roomId, currentSpaceIdRef.current, client)
          ? currentSpaceIdRef.current
          : findParentSpaceId(roomId, client);
      setSidebarView(keepSpaceId ? 'space' : 'home');
      setCurrentSpaceId(keepSpaceId);
      return;
    }

    if (path === '/') {
      setSidebarView(stateSidebar ?? 'home');
      setCurrentSpaceId(stateSpaceId !== undefined ? stateSpaceId : null);
      setCurrentRoomId(null);
    }
  }, [
    location.pathname,
    stateSidebar,
    stateSpaceId,
    client,
    setSidebarView,
    setCurrentSpaceId,
    setCurrentRoomId,
  ]);

  const openGlobalSearch = useSetAtom(globalSearchOpenAtom);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openGlobalSearch]);

  // Keyboard shortcuts settings
  const openSettings = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setSettingsPage('keybinds');
        openSettings(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openSettings, setSettingsPage]);

  const setInboxOpen = useSetAtom(inboxOpenAtom);
  const setCreateSpaceOpen = useSetAtom(createSpaceOpenAtom);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isModOnly(e) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'i' && !e.shiftKey && !isEditableTarget(e)) {
        e.preventDefault();
        setInboxOpen((open) => !open);
      } else if (key === 'n' && e.shiftKey) {
        e.preventDefault();
        setCreateSpaceOpen({ open: true });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setInboxOpen, setCreateSpaceOpen]);

  useSyncListener(client);
  const syncReady = useSyncReady();

  useSettingsSync(client);
  useMatrixToLinks(client);
  useGifFavouritesSync(client);
  useDesktopDeviceName(client);
  useEnsureMudrixUserFlag(client);
  useUnifiedPushSync(client);
  useProfileLiveSync(client);

  // Session expiry
  useEffect(() => {
    if (!client) return;
    const handler = () => {
      void logout(client.getUserId());
    };
    client.on('Session.logged_out' as Parameters<typeof client.on>[0], handler);
    return () => {
      client.off('Session.logged_out' as Parameters<typeof client.off>[0], handler);
    };
  }, [client]);

  // Cross-tab token rotation
  useEffect(() => {
    if (!client) return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_ACCOUNTS || !e.newValue) return;
      try {
        const accounts = JSON.parse(e.newValue) as AccountsMap;
        const myId = client.getUserId();
        const next = myId ? accounts[myId] : null;
        if (next && next.accessToken && next.accessToken !== client.getAccessToken()) {
          client.setAccessToken(next.accessToken);
        }
        // Keep the SDK's refresh token in step too, or the next refresh would reuse a spent one.
        if (next?.refreshToken && next.refreshToken !== client.getRefreshToken()) {
          client.http.opts.refreshToken = next.refreshToken;
        }
      } catch {
        // ignore malformed storage
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [client]);

  // Security
  useVerification(client);
  useEncryptionSetupWarning(client, syncReady);
  useQrImportNotice();
  useAutoKeyBackupRestore(client, syncReady);

  const elementCallActions = useAtomValue(callActionsAtom);
  const isInElementCall = useAtomValue(isInCallAtom);
  const startElementCall = elementCallActions?.start;
  const hangupElementCall = elementCallActions?.hangup;
  const elementToggleMute = elementCallActions?.toggleMute;
  const elementToggleDeafen = elementCallActions?.toggleDeafen;
  const elementToggleVideo = elementCallActions?.toggleVideo;

  const startCallInRoom = useCallback(
    async (roomId: string, presentation: CallPresentation) => {
      if (!client || !startElementCall) return;
      const room = client.getRoom(roomId);
      if (!room) return;
      await startElementCall(room, { voiceOnly: true, presentation });
    },
    [client, startElementCall]
  );

  const placeCall = useCallback(
    (roomId: string) => startCallInRoom(roomId, 'room'),
    [startCallInRoom]
  );

  const joinVoiceRoom = useJoinVoiceRoom(client);
  useVoiceMoves(client, joinVoiceRoom);

  const setCommandActions = useSetAtom(commandActionsAtom);
  useEffect(() => {
    setCommandActions({
      placeCall,
      joinVoice: joinVoiceRoom,
      hangup: hangupElementCall,
    });
    return () => setCommandActions(null);
  }, [placeCall, joinVoiceRoom, hangupElementCall, setCommandActions]);

  // Keyboard shortcuts
  const [membersPanelOpen, setMembersPanelOpen] = useAtom(membersPanelOpenAtom);
  const [spaceMembersPanelOpen, setSpaceMembersPanelOpen] = useAtom(spaceMembersPanelOpenAtom);
  // The room members panel is hidden on a space overview
  const membersPanelVisible = spaceOverviewSpaceId ? spaceMembersPanelOpen : membersPanelOpen;
  const setMembersVisible = spaceOverviewSpaceId ? setSpaceMembersPanelOpen : setMembersPanelOpen;
  const [threadsPanelView, setThreadsPanelView] = useAtom(threadsPanelViewAtom);
  const threadPanelExpanded = useAtomValue(threadPanelExpandedAtom);

  const [threadsClosing, setThreadsClosing] = useState(false);
  const closeThreadsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelThreadsClose = useCallback(() => {
    if (closeThreadsTimer.current !== null) {
      clearTimeout(closeThreadsTimer.current);
      closeThreadsTimer.current = null;
    }
    setThreadsClosing(false);
  }, []);

  const closeThreads = useCallback(() => {
    if (!threadsPanelView) return;
    setThreadsClosing(true);
    if (closeThreadsTimer.current !== null) clearTimeout(closeThreadsTimer.current);
    closeThreadsTimer.current = setTimeout(() => {
      setThreadsPanelView(null);
      setThreadsClosing(false);
      closeThreadsTimer.current = null;
    }, 220);
  }, [threadsPanelView, setThreadsPanelView]);

  useEffect(() => () => cancelThreadsClose(), [cancelThreadsClose]);

  // A fresh open request cancels an in-flight closing animation
  useEffect(() => {
    if (threadsPanelView) cancelThreadsClose();
  }, [threadsPanelView, cancelThreadsClose]);

  // Voice-room chat panel (opened via the room list's "Open chat" action)
  const roomChatOpen = useAtomValue(roomChatPanelOpenAtom);
  const roomChatRoomId = useAtomValue(roomChatRoomIdAtom);
  const closeRoomChat = useSetAtom(closeRoomChatAtom);
  const callRoomId = useAtomValue(callRoomIdAtom);
  const callView = useAtomValue(callEffectiveViewAtom);
  const [roomChatClosing, setRoomChatClosing] = useState(false);
  const roomChatCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRoomChatClose = useCallback(() => {
    if (roomChatCloseTimer.current !== null) {
      clearTimeout(roomChatCloseTimer.current);
      roomChatCloseTimer.current = null;
    }
    setRoomChatClosing(false);
  }, []);

  const closeRoomChatPanel = useCallback(() => {
    if (!roomChatOpen) return;
    setRoomChatClosing(true);
    if (roomChatCloseTimer.current !== null) clearTimeout(roomChatCloseTimer.current);
    roomChatCloseTimer.current = setTimeout(() => {
      closeRoomChat();
      setRoomChatClosing(false);
      roomChatCloseTimer.current = null;
    }, 220);
  }, [roomChatOpen, closeRoomChat]);

  useEffect(() => () => cancelRoomChatClose(), [cancelRoomChatClose]);

  useEffect(() => {
    if (roomChatOpen) cancelRoomChatClose();
  }, [roomChatOpen, cancelRoomChatClose]);

  useEffect(() => {
    if (!roomChatOpen || !roomChatRoomId) return;
    const room = currentRoomId ? client?.getRoom(currentRoomId) : null;
    const sameRoom = !!room && room.roomId === roomChatRoomId;
    // Voice rooms have no timeline, so the panel is always the chat surface there.
    const voiceRoomChat = !!room && isVoiceRoom(room);
    // Normal rooms keep their own timeline visible except while a fullscreen call covers it.
    const callCoversTimeline = callRoomId === roomChatRoomId && callView === 'fullscreen';
    if (!sameRoom || (!voiceRoomChat && !callCoversTimeline)) closeRoomChatPanel();
  }, [
    roomChatOpen,
    roomChatRoomId,
    currentRoomId,
    client,
    callRoomId,
    callView,
    closeRoomChatPanel,
  ]);

  const threadPanelRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (threadsPanelView && currentRoomId) threadPanelRoomIdRef.current = currentRoomId;
  }, [threadsPanelView, currentRoomId]);

  const prevRoomIdRef = useRef<string | null>(currentRoomId);
  useEffect(() => {
    const prev = prevRoomIdRef.current;
    prevRoomIdRef.current = currentRoomId;
    if (
      currentRoomId !== null &&
      prev !== currentRoomId &&
      threadPanelRoomIdRef.current !== currentRoomId
    ) {
      cancelThreadsClose();
      setThreadsPanelView(null);
    }
  }, [currentRoomId, cancelThreadsClose, setThreadsPanelView]);

  useEffect(() => {
    if (membersPanelOpen) cancelThreadsClose();
  }, [membersPanelOpen, cancelThreadsClose]);

  useEffect(() => {
    if (spaceOverviewSpaceId) setSpaceMembersPanelOpen(false);
  }, [spaceOverviewSpaceId, setSpaceMembersPanelOpen]);

  useVoiceKeybinds(isInElementCall, {
    toggleMute: elementToggleMute ?? (() => {}),
    toggleDeafen: elementToggleDeafen ?? (() => {}),
    toggleVideo: elementToggleVideo ?? (() => {}),
    disconnect: hangupElementCall ?? (() => {}),
  });

  useClientNotifications();
  useMediaDeviceSettings();
  useHydrateAuthImages(getMatrixClientOrNull());
  useSlidingSyncSubscription();
  useAutoJoinSpaceRooms();

  useEffect(() => {
    registerNotificationServiceWorker();
  }, []);

  useFaviconBadge();
  useUpdateCheck();

  usePresenceSender(client);
  useActivitySharing(client);
  useStreamerMode();
  useReminderDelivery(client);
  useSpaceNicknameSync(client);
  useBindFavouriteRooms(client);
  usePresenceListener(client);

  const sidebarClass = `${css.sidebar} ${SWIPE_PANEL_LEFT}${drawerOpen ? ` ${css.sidebarOpen}` : ''}`;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const panelsOverlay = useMediaQuery(PANEL_OVERLAY_QUERY);
  // Where these panels are overlays (phones, tablets), the system back gesture should dismiss them.
  useBackToClose(panelsOverlay && membersPanelVisible, () => setMembersVisible(false));
  useBackToClose(panelsOverlay && !!threadsPanelView, closeThreads);
  // Back from a room opens the room list (the left drawer) instead of leaving for the previous
  // page. The list opened that way has no history entry of its own, so a second Back leaves as
  // normal; closing it by hand brings the room's entry back.
  const [listFromBack, setListFromBack] = useState(false);
  useEffect(() => {
    if (!drawerOpen) setListFromBack(false);
  }, [drawerOpen]);
  const inRoomView = panelsOverlay && location.pathname !== '/';
  useBackToClose(inRoomView && !drawerOpen, () => {
    setListFromBack(true);
    setDrawerOpen(true);
  });
  useBackToClose(panelsOverlay && drawerOpen && !listFromBack, () => setDrawerOpen(false));
  useSwipePanels({
    enabled: panelsOverlay,
    leftOpen: drawerOpen,
    setLeftOpen: setDrawerOpen,
    // Threads are a bottom drawer, so only the members panel answers sideways swipes.
    rightOpen: membersPanelVisible,
    setRightOpen: (open) => {
      setMembersVisible(open);
    },
    canOpenRight: !!currentRoomId || !!spaceOverviewSpaceId,
  });

  return (
    <>
      <AccountSwitchGuard client={client} />

      <CallContainerProvider>
        <div className={css.appFrame}>
          <MobileHeader />
          {!isMobile && (
            <TitleBar
              start={
                <button
                  type="button"
                  className={css.titleBarMenuBtn}
                  onClick={() => setDrawerOpen(!drawerOpen)}
                  aria-label={t('common.menu')}
                  aria-expanded={drawerOpen}
                >
                  <ListIcon size={20} />
                </button>
              }
              center={<TitleBarSearch />}
              end={
                <>
                  <UpdateButton />
                  <EncryptionWarningButton />
                  <Inbox />
                </>
              }
            />
          )}
          <ConnectionBanner />
          <div className={css.appShell}>
            {/* Mobile overlay */}
            {drawerOpen && (
              <div
                className={css.drawerOverlay}
                role="presentation"
                data-swipe-scrim="left"
                onClick={() => setDrawerOpen(false)}
              />
            )}

            {/* Sidebar: spaces column + room list panel */}
            <nav aria-label={t('room.navigation')} className={sidebarClass}>
              <SpacesList
                sidebarView={sidebarView}
                currentSpaceId={currentSpaceId}
                onSelectView={handleSelectView}
              />
              <RoomListPanel onVoiceJoin={joinVoiceRoom} />
            </nav>

            {/* Main content — element call layer above the chat timeline */}
            <main
              className={`${css.mainContent}${threadsPanelView && threadPanelExpanded ? ` ${css.mainContentHidden}` : ''}`}
            >
              <CallContainer />
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/space/:spaceId" element={<SpaceOverviewPage />} />
                <Route path="/r/:roomId" element={<RoomPage />} />
                <Route path="/dm/:roomId" element={<RoomPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <ElementCallLayer client={client} />
              <CallController />
              <WatchTogetherController />
            </main>

            <MembersSidebar
              spaceId={sidebarRoomId}
              open={membersPanelVisible}
              onClose={() => setMembersVisible(false)}
              className={`${
                membersPanelVisible
                  ? sidebarCss.membersSidebarOpen
                  : sidebarCss.membersSidebarClosed
              } ${SWIPE_PANEL_RIGHT}`}
            />
            {membersPanelVisible && (
              <div
                className={css.membersDrawerOverlay}
                role="presentation"
                data-swipe-scrim="right"
                onClick={() => setMembersVisible(false)}
              />
            )}

            {threadsPanelView && currentRoomId && client && (
              <>
                {threadsPanelView.type === 'list' ? (
                  <ThreadListPanel
                    client={client}
                    roomId={currentRoomId}
                    className={`${threadsClosing ? '' : sidePanelCss.sidePanelOpen}`}
                    onSelectThread={(rootEvent) =>
                      setThreadsPanelView({ type: 'thread', rootEvent })
                    }
                    onClose={closeThreads}
                  />
                ) : (
                  <ThreadPanel
                    client={client}
                    roomId={currentRoomId}
                    rootEvent={threadsPanelView.rootEvent}
                    className={`${threadsClosing ? '' : threadPanelCss.threadPanelOpen}`}
                    onClose={closeThreads}
                    onBack={() => setThreadsPanelView({ type: 'list' })}
                  />
                )}
                <div className={css.drawerOverlay} role="presentation" onClick={closeThreads} />
              </>
            )}

            {roomChatOpen && roomChatRoomId && client && (
              <>
                <VoiceRoomChatPanel
                  client={client}
                  roomId={roomChatRoomId}
                  className={roomChatClosing ? undefined : sidePanelCss.sidePanelOpen}
                  onClose={closeRoomChatPanel}
                />
                <div
                  className={css.drawerOverlay}
                  role="presentation"
                  onClick={closeRoomChatPanel}
                />
              </>
            )}
          </div>
        </div>
      </CallContainerProvider>

      <GlobalModals />
    </>
  );
}
