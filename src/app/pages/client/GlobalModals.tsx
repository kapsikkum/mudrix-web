import { ToastContainer } from '@/app/components/Toast';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { PromptModal } from '@/app/components/PromptModal';
import { CreateRoomModal, InviteModal, RoomSettings } from '@/app/features/room';
import { EditMessageModal, EmojiPicker } from '@/app/features/timeline';
import { NewDmModal } from '@/app/features/dm/NewDmModal';
import { VerificationBanner, EmojiVerificationModal } from '@/app/features/device';
import { RecoveryKeyModal, EnterRecoveryKeyModal } from '@/app/features/keybackup';
import { ContextMenu } from '@/app/features/contextMenu/ContextMenu';
import { SpaceSettings, CreateSpaceModal } from '@/app/features/space';
import { Settings } from '@/app/features/settings';
import { GlobalSearch } from '@/app/features/globalSearch/GlobalSearch';
import { ExploreModal } from '@/app/features/explore';

export function GlobalModals() {
  return (
    <>
      <ToastContainer />
      <ConfirmModal />
      <PromptModal />
      <Settings />
      <CreateRoomModal />
      <InviteModal />
      <NewDmModal />
      <SpaceSettings />
      <CreateSpaceModal />
      <RoomSettings />
      <EditMessageModal />
      <EmojiPicker />
      <VerificationBanner />
      <EmojiVerificationModal />
      <RecoveryKeyModal />
      <EnterRecoveryKeyModal />
      <ContextMenu />
      <GlobalSearch />
      <ExploreModal />
    </>
  );
}
