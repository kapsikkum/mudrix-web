import { ToastContainer } from '@/app/components/Toast';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { PromptModal } from '@/app/components/PromptModal';
import { CreateRoomModal, InviteModal, RoomSettings } from '@/app/features/room';
import { EmojiPicker, AttachmentPreviewModal } from '@/app/features/timeline';
import { NewDmModal } from '@/app/features/dm/NewDmModal';
import { VerificationBanner, EmojiVerificationModal } from '@/app/features/device';
import {
  RecoveryKeyModal,
  EnterRecoveryKeyModal,
  SetupRecoveryKeyModal,
  CrossSigningUiaModal,
} from '@/app/features/keybackup';
import { ContextMenu } from '@/app/features/contextMenu/ContextMenu';
import { SpaceSettings, CreateSpaceModal } from '@/app/features/space';
import { UserProfilePopup } from '@/app/features/profile';
import { Settings } from '@/app/features/settings';
import { KeyboardShortcutsHelp } from '@/app/features/keyboardShortcuts/KeyboardShortcutsHelp';
import { RoomSwitcher } from '@/app/features/roomSwitcher/RoomSwitcher';
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
      <EmojiPicker />
      <AttachmentPreviewModal />
      <VerificationBanner />
      <EmojiVerificationModal />
      <RecoveryKeyModal />
      <EnterRecoveryKeyModal />
      <SetupRecoveryKeyModal />
      <CrossSigningUiaModal />
      <ContextMenu />
      <UserProfilePopup />
      <KeyboardShortcutsHelp />
      <RoomSwitcher />
      <ExploreModal />
    </>
  );
}
