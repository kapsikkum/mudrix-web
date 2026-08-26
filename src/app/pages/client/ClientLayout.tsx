import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  currentSpaceIdAtom,
  currentRoomIdAtom,
  sidebarViewAtom,
  mobileDrawerOpenAtom,
  keyboardShortcutsOpenAtom,
  roomSwitcherOpenAtom,
  newDmOpenAtom,
  createSpaceOpenAtom,
  membersPanelOpenAtom,
  threadsPanelViewAtom,
  credentialsAtom,
  isInElementCallAtom,
  elementCallActionsAtom,
} from '@/app/store/atoms';
import { commandActionsAtom } from '@/app/store/atoms/call';
import type { SidebarView } from '@/app/store/atoms';
import { useSyncListener, useSyncReady } from '@/app/hooks/useSync';
import { useConfirm } from '@/app/hooks/useConfirm';
import { useSettingsSync } from '@/app/hooks/useSettingsSync';
import { useAutoRestorePrompt } from '@/app/hooks/useAutoRestorePrompt';
import { useAutoSetupPrompt } from '@/app/hooks/useAutoSetupPrompt';
import { useVerification } from '@/app/hooks/useVerification';
import { useVoiceKeybinds } from '@/app/hooks/useKeybinds';
import { getMatrixClientOrNull, clearCredentials } from '@/client/initMatrix';
import { STORAGE_KEY_CREDENTIALS } from '@/const/storageKeys';
import type { MatrixCredentials } from '@/client/types';
import { Timeline } from '@/app/features/timeline';
import { LogoHover } from '@/app/components/AppLoading';
import { ConnectionBanner } from '@/app/components/ConnectionBanner';
import { ElementCallLayer } from '@/app/features/calls/ElementCallLayer';
import { CallEmbedProvider } from '@/app/plugins/call/CallEmbedProvider';
import { ElementCallController } from '@/app/features/calls/ElementCallController';
import { useTranslation } from 'react-i18next';
import { useClientNotifications } from './hooks/useClientNotifications';
import { useFaviconBadge } from '@/app/hooks/useFaviconBadge';
import { registerNotificationServiceWorker } from '@/app/hooks/useNotifications';
import { useUpdateCheck } from '@/app/hooks/useUpdateCheck';
import { usePresenceSender } from '@/app/hooks/usePresenceSender';
import { usePresenceListener } from '@/app/hooks/usePresenceListener';
import { UpdateToast } from '@/app/components/UpdateToast/UpdateToast';
import { SpacesList } from './SpacesList';
import { RoomListPanel } from './RoomListPanel';
import { MembersSidebar } from './MembersSidebar';
import * as sidebarCss from './MembersSidebar.css';
import * as threadPanelCss from './ThreadPanel.css';
import * as threadListCss from './ThreadListPanel.css';
import { ThreadPanel } from './ThreadPanel';
import { ThreadListPanel } from './ThreadListPanel';
import { MobileHeader } from './MobileHeader';
import { GlobalModals } from './GlobalModals';
import { SpaceOverview } from './SpaceOverview';
import { Button } from '@/app/components/Button';
import { ChatCircleIcon, StackIcon } from '@phosphor-icons/react';
import * as css from './ClientLayout.css';

function HomePage() {
  const { t } = useTranslation();
  const setNewDmOpen = useSetAtom(newDmOpenAtom);
  const setCreateSpaceOpen = useSetAtom(createSpaceOpenAtom);
  return (
    <div className={css.welcomeHome}>
      <LogoHover size={72} />
      <h1 className={css.welcomeTitle}>{t('timeline.welcomeTitle')}</h1>
      <p>{t('timeline.welcomeBody')}</p>
      <div className={css.welcomeActions}>
        <Button variant="secondary" onClick={() => setNewDmOpen(true)}>
          <ChatCircleIcon size={16} className={css.iconBefore} />
          {t('timeline.startDm')}
        </Button>
        <Button variant="secondary" onClick={() => setCreateSpaceOpen({ open: true })}>
          <StackIcon size={16} className={css.iconBefore} />
          {t('room.space.create.title')}
        </Button>
      </div>
    </div>
  );
}

const RoomPage = memo(function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const client = getMatrixClientOrNull();
  if (!client || !roomId) return null;
  const decodedRoomId = decodeURIComponent(roomId);
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

  const handleSelectView = useCallback(
    (view: SidebarView, spaceId?: string | null) => {
      setSidebarView(view);
      if (spaceId !== undefined) setCurrentSpaceId(spaceId);
    },
    [setSidebarView, setCurrentSpaceId]
  );

  const location = useLocation();
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
  useEffect(() => {
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
      setCurrentRoomId(decodeURIComponent(roomMatch[1]));
      if (stateSidebar) setSidebarView(stateSidebar);
      if (stateSpaceId !== undefined) setCurrentSpaceId(stateSpaceId);
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
    setSidebarView,
    setCurrentSpaceId,
    setCurrentRoomId,
  ]);

  const openRoomSwitcher = useSetAtom(roomSwitcherOpenAtom);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openRoomSwitcher(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openRoomSwitcher]);

  // Keyboard shortcuts help
  const openKeyboardShortcuts = useSetAtom(keyboardShortcutsOpenAtom);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        openKeyboardShortcuts(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openKeyboardShortcuts]);

  useSyncListener(client);
  const syncReady = useSyncReady();

  useSettingsSync(client);

  // Session expiry
  useEffect(() => {
    if (!client) return;
    const handler = () => {
      clearCredentials();
      window.location.href = '/welcome';
    };
    client.on('Session.logged_out' as Parameters<typeof client.on>[0], handler);
    return () => {
      client.off('Session.logged_out' as Parameters<typeof client.off>[0], handler);
    };
  }, [client]);

  // Cross-tab token rotation
  const setCredentials = useSetAtom(credentialsAtom);
  useEffect(() => {
    if (!client) return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_CREDENTIALS || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as MatrixCredentials;
        if (next.accessToken && next.accessToken !== client.getAccessToken()) {
          client.setAccessToken(next.accessToken);
          setCredentials(next);
        }
      } catch {
        // ignore malformed storage
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [client, setCredentials]);

  // Security
  useVerification(client);
  useAutoRestorePrompt(client, syncReady);
  useAutoSetupPrompt(client, syncReady);

  const elementCallActions = useAtomValue(elementCallActionsAtom);
  const isInElementCall = useAtomValue(isInElementCallAtom);
  const confirmDialog = useConfirm();
  const startElementCall = elementCallActions?.start;
  const hangupElementCall = elementCallActions?.hangup;
  const elementToggleMute = elementCallActions?.toggleMute;
  const elementToggleDeafen = elementCallActions?.toggleDeafen;
  const elementToggleVideo = elementCallActions?.toggleVideo;

  const placeCall = useCallback(
    async (roomId: string) => {
      if (!client || !startElementCall) return;
      const room = client.getRoom(roomId);
      if (!room) return;
      await startElementCall(room, { voiceOnly: true });
    },
    [client, startElementCall]
  );

  const joinVoiceWithExclusion = useCallback(
    async (roomId: string) => {
      const switchRoom = () => placeCall(roomId);

      if (isInElementCall) {
        const confirmed = await confirmDialog({
          title: t('room.switchVoiceRoom'),
          message: t('room.switchVoiceRoomMessage'),
          confirmLabel: t('room.switch'),
          cancelLabel: t('common.cancel'),
          cancelPrimary: true,
        });
        if (confirmed) await switchRoom();
        return;
      }

      await switchRoom();
    },
    [isInElementCall, placeCall, t, confirmDialog]
  );

  const setCommandActions = useSetAtom(commandActionsAtom);
  useEffect(() => {
    setCommandActions({
      placeCall,
      joinVoice: joinVoiceWithExclusion,
      hangup: hangupElementCall,
    });
    return () => setCommandActions(null);
  }, [placeCall, joinVoiceWithExclusion, hangupElementCall, setCommandActions]);

  // Keyboard shortcuts
  const [membersPanelOpen, setMembersPanelOpen] = useAtom(membersPanelOpenAtom);
  const [threadsPanelView, setThreadsPanelView] = useAtom(threadsPanelViewAtom);

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

  // Close threads panel when navigating away from a room
  useEffect(() => {
    if (!currentRoomId) {
      cancelThreadsClose();
      setThreadsPanelView(null);
    }
  }, [currentRoomId, setThreadsPanelView, cancelThreadsClose]);

  // Only one side panel can be open at a time
  useEffect(() => {
    if (threadsPanelView) setMembersPanelOpen(false);
  }, [threadsPanelView, setMembersPanelOpen]);

  useEffect(() => {
    if (membersPanelOpen) {
      cancelThreadsClose();
      setThreadsPanelView(null);
    }
  }, [membersPanelOpen, setThreadsPanelView, cancelThreadsClose]);

  useVoiceKeybinds(isInElementCall, {
    toggleMute: elementToggleMute ?? (() => {}),
    toggleDeafen: elementToggleDeafen ?? (() => {}),
    toggleVideo: elementToggleVideo ?? (() => {}),
    disconnect: hangupElementCall ?? (() => {}),
  });

  useClientNotifications();

  useEffect(() => {
    registerNotificationServiceWorker();
  }, []);

  useFaviconBadge();
  useUpdateCheck();

  usePresenceSender(client);
  usePresenceListener(client);

  const sidebarClass = `${css.sidebar}${drawerOpen ? ` ${css.sidebarOpen}` : ''}`;

  return (
    <>
      <ConnectionBanner />
      <MobileHeader />

      <div className={css.appShell}>
        {/* Mobile overlay */}
        {drawerOpen && (
          <div
            className={css.drawerOverlay}
            role="presentation"
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
          <RoomListPanel onVoiceJoin={joinVoiceWithExclusion} />
        </nav>

        {/* Main content — element call layer above the chat timeline */}
        <main className={css.mainContent}>
          <CallEmbedProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/space/:spaceId" element={<SpaceOverviewPage />} />
              <Route path="/r/:roomId" element={<RoomPage />} />
              <Route path="/dm/:roomId" element={<RoomPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ElementCallLayer client={client} />
            <ElementCallController />
          </CallEmbedProvider>
        </main>

        <MembersSidebar
          spaceId={sidebarRoomId}
          className={
            membersPanelOpen ? sidebarCss.membersSidebarOpen : sidebarCss.membersSidebarClosed
          }
        />
        {membersPanelOpen && (
          <div
            className={css.membersDrawerOverlay}
            role="presentation"
            onClick={() => setMembersPanelOpen(false)}
          />
        )}

        {threadsPanelView && currentRoomId && client && (
          <>
            {threadsPanelView.type === 'list' ? (
              <ThreadListPanel
                client={client}
                roomId={currentRoomId}
                className={threadsClosing ? undefined : threadListCss.threadListPanelOpen}
                onSelectThread={(rootEvent) => setThreadsPanelView({ type: 'thread', rootEvent })}
                onClose={closeThreads}
              />
            ) : (
              <ThreadPanel
                client={client}
                roomId={currentRoomId}
                rootEvent={threadsPanelView.rootEvent}
                className={threadsClosing ? undefined : threadPanelCss.threadPanelOpen}
                onClose={closeThreads}
                onBack={() => setThreadsPanelView({ type: 'list' })}
              />
            )}
            <div className={css.threadDrawerOverlay} role="presentation" onClick={closeThreads} />
          </>
        )}
      </div>

      {/* Global modals and overlays */}
      <GlobalModals />

      {/* Update available toast */}
      <UpdateToast />
    </>
  );
}
