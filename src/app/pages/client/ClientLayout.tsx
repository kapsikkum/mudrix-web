import { useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  currentSpaceIdAtom,
  sidebarViewAtom,
  mobileDrawerOpenAtom,
  isInVoiceCallAtom,
  callStateAtom,
  globalSearchOpenAtom,
  newDmOpenAtom,
  createSpaceOpenAtom,
} from '@/app/store/atoms';
import { placeCallAtom } from '@/app/store/atoms/call';
import type { SidebarView } from '@/app/store/atoms';
import { useSyncListener, useSyncReady } from '@/app/hooks/useSync';
import { useAutoRestorePrompt } from '@/app/hooks/useAutoRestorePrompt';
import { useVerification } from '@/app/hooks/useVerification';
import { useVoice } from '@/app/hooks/useVoice';
import { useVoiceKeybinds } from '@/app/hooks/useKeybinds';
import { useCall } from '@/app/hooks/useCall';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Timeline } from '@/app/features/timeline';
import { LogoHover } from '@/app/components/AppLoading';
import { ConnectionBanner } from '@/app/components/ConnectionBanner';
import { JitsiEmbed } from '@/app/features/voice/JitsiEmbed';
import { IncomingCallOverlay } from '@/app/features/calls/IncomingCallOverlay';
import { useTranslation } from 'react-i18next';
import { useClientNotifications } from './hooks/useClientNotifications';
import { useUpdateCheck } from '@/app/hooks/useUpdateCheck';
import { UpdateToast } from '@/app/components/UpdateToast/UpdateToast';
import { SpacesList } from './SpacesList';
import { RoomListPanel } from './RoomListPanel';
import { MembersSidebar } from './MembersSidebar';
import { MobileHeader } from './MobileHeader';
import { GlobalModals } from './GlobalModals';
import { ActiveCallBar } from './ActiveCallBar';
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
      <h3 className={css.welcomeTitle}>{t('timeline.welcomeTitle')}</h3>
      <p>{t('timeline.welcomeBody')}</p>
      <div className={css.welcomeActions}>
        <Button variant="secondary" onClick={() => setNewDmOpen(true)}>
          <ChatCircleIcon size={16} className={css.iconBefore} />
          {t('timeline.startDm')}
        </Button>
        <Button variant="secondary" onClick={() => setCreateSpaceOpen(true)}>
          <StackIcon size={16} className={css.iconBefore} />
          {t('room.space.create.title')}
        </Button>
      </div>
    </div>
  );
}

function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const client = getMatrixClientOrNull();
  if (!client || !roomId) return null;
  const decodedRoomId = decodeURIComponent(roomId);
  // Timeline reads call state from atoms directly — no prop needed
  return <Timeline client={client} roomId={decodedRoomId} />;
}

export function ClientLayout() {
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

  // Global search — Ctrl+K / Cmd+K shortcut
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

  // Sync
  useSyncListener(client);
  const syncReady = useSyncReady();

  // Security
  useVerification(client);
  useAutoRestorePrompt(client, syncReady);

  // Voice channel (Jitsi) — persists across room navigations
  const {
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleVideo,
    popOut: popOutVoice,
    popIn: popInVoice,
    attachContainer,
  } = useVoice(client);

  // 1:1 VoIP call
  const { accept, decline, hangup, toggleMute: toggleCallMute, placeCall } = useCall(client);
  const callState = useAtomValue(callStateAtom);
  const setPlaceCall = useSetAtom(placeCallAtom);
  useEffect(() => {
    setPlaceCall(() => placeCall);
    return () => setPlaceCall(null);
  }, [placeCall, setPlaceCall]);

  // Voice keyboard shortcuts
  const isInVoiceCall = useAtomValue(isInVoiceCallAtom);
  useVoiceKeybinds(isInVoiceCall, { toggleMute, toggleVideo, disconnect: leaveVoice });

  // Prevent accidental page refresh/close while in a call
  useEffect(() => {
    const isInCall = isInVoiceCall || callState.active;
    if (!isInCall) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isInVoiceCall, callState.active]);

  useClientNotifications();
  useUpdateCheck();

  const sidebarClass = `${css.sidebar}${drawerOpen ? ` ${css.sidebarOpen}` : ''}`;

  return (
    <>
      <ConnectionBanner />
      <MobileHeader />

      <div className={css.appShell}>
        {/* Mobile overlay */}
        {drawerOpen && <div className={css.drawerOverlay} onClick={() => setDrawerOpen(false)} />}

        {/* Sidebar: spaces column + room list panel */}
        <div className={sidebarClass}>
          <SpacesList
            sidebarView={sidebarView}
            currentSpaceId={currentSpaceId}
            onSelectView={handleSelectView}
          />
          <RoomListPanel
            onVoiceLeave={leaveVoice}
            onVoiceToggleMute={toggleMute}
            onVoiceToggleVideo={toggleVideo}
            onVoiceJoin={joinVoice}
          />
        </div>

        {/* Main content — Jitsi embed sits above the chat timeline */}
        <main className={css.mainContent}>
          <JitsiEmbed
            onLeave={leaveVoice}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onPopOut={popOutVoice}
            onPopIn={popInVoice}
            onAttachContainer={attachContainer}
          />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/r/:roomId" element={<RoomPage />} />
            <Route path="/dm/:roomId" element={<RoomPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <MembersSidebar />
      </div>

      {/* Global modals and overlays */}
      <GlobalModals />

      {/* 1:1 incoming call notification */}
      {callState.incoming && client && callState.callerId && (
        <IncomingCallOverlay
          callerName={callState.callerName ?? callState.callerId}
          callerId={callState.callerId}
          client={client}
          onAccept={accept}
          onDecline={decline}
        />
      )}

      {/* Active call controls */}
      <ActiveCallBar callState={callState} onHangup={hangup} onToggleMute={toggleCallMute} />

      {/* Update available toast */}
      <UpdateToast />
    </>
  );
}
