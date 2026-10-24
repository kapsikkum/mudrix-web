import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  ArrowSquareInIcon,
  ArrowSquareOutIcon,
  ArrowsInIcon,
  ArrowsOutIcon,
  ChatTextIcon,
  DotsThreeVerticalIcon,
  GearIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  MonitorArrowUpIcon,
  PhoneXIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { Popover } from '@/app/components/Popover';
import {
  elementCallActionsAtom,
  elementCallEffectiveViewAtom,
  elementCallEmbedAtom,
  elementCallUiAtom,
} from '@/app/store/atoms/elementCall';
import {
  openRoomChatAtom,
  closeRoomChatAtom,
  roomChatPanelOpenAtom,
  roomChatRoomIdAtom,
} from '@/app/store/atoms';
import { isVoiceRoom } from '@/util/matrix';
import { useReturnToCall } from './useReturnToCall';
import {
  callPopoutWindowAtom,
  canOpenCallPopoutWindow,
  openCallPopoutWindow,
} from './CallPopoutWindow';
import { isTauriMobile } from '@/util/desktop';
import * as css from './CallControlBar.css';

/** Phones have no room for a popout: the call already fills the screen. */

const isMobileLayout = () => isTauriMobile() || window.matchMedia('(max-width: 768px)').matches;

export function CallControlBar() {
  const { t } = useTranslation();
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
  const view = useAtomValue(elementCallEffectiveViewAtom);
  const roomChatOpen = useAtomValue(roomChatPanelOpenAtom);
  const roomChatRoomId = useAtomValue(roomChatRoomIdAtom);
  const openRoomChat = useSetAtom(openRoomChatAtom);
  const closeRoomChat = useSetAtom(closeRoomChatAtom);
  const returnToCall = useReturnToCall();
  const setPopoutWindow = useSetAtom(callPopoutWindowAtom);

  // Desktop pops out into a window of its own; elsewhere it is a small tile inside the app.
  const popOut = () => {
    if (!canOpenCallPopoutWindow()) {
      actions?.setPresentation('tile');
      return;
    }
    openCallPopoutWindow()
      .then((win) => {
        setPopoutWindow(win);
        actions?.setPresentation('tile');
      })
      .catch(() => actions?.setPresentation('tile'));
  };
  const menuBtnRef = useRef<HTMLSpanElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const doc = embed?.document;
    if (!doc) return;
    const close = () => setMenuOpen(false);
    doc.addEventListener('mousedown', close);
    return () => doc.removeEventListener('mousedown', close);
  }, [menuOpen, embed]);

  if (!actions) return null;

  const micTitle = ui.isMuted ? t('voice.unmute') : t('voice.mute');
  const deafenTitle = ui.isDeafened ? t('voice.undeafen') : t('voice.deafen');
  const cameraTitle = ui.isVideoMuted ? t('voice.cameraOff') : t('voice.cameraOn');
  const shareTitle = ui.isScreenSharing ? t('voice.stopShare') : t('voice.shareScreen');
  const closeMenu = () => setMenuOpen(false);

  const chatRoomId = ui.roomId;
  const chatOpen = roomChatOpen && roomChatRoomId === chatRoomId;
  const chatTitle = chatOpen ? t('common.close') : t('room.openChat');
  const isVoiceCall = !!embed && isVoiceRoom(embed.room);
  const toggleChat = () => {
    if (!chatRoomId) return;
    if (chatOpen) closeRoomChat();
    else openRoomChat(chatRoomId);
  };

  return (
    <div className={css.bar} role="group" aria-label={t('voice.controls')}>
      <div className={css.group}>
        <Tooltip content={micTitle}>
          <button
            type="button"
            className={ui.isMuted ? css.ctrlDanger : css.ctrl}
            onClick={() => actions.toggleMute()}
            aria-label={micTitle}
            aria-pressed={ui.isMuted}
          >
            {ui.isMuted ? <MicrophoneSlashIcon size={20} /> : <MicrophoneIcon size={20} />}
          </button>
        </Tooltip>

        <Tooltip content={deafenTitle}>
          <button
            type="button"
            className={ui.isDeafened ? css.ctrlDanger : css.ctrl}
            onClick={() => actions.toggleDeafen()}
            aria-label={deafenTitle}
            aria-pressed={ui.isDeafened}
          >
            <span className={css.deafenIcon}>
              <HeadphonesIcon size={20} />
              {ui.isDeafened && (
                <span className={css.deafenIconSlash}>
                  <span className={css.deafenIconOutline} />
                  <span className={css.deafenIconCore} />
                </span>
              )}
            </span>
          </button>
        </Tooltip>

        <Tooltip content={cameraTitle}>
          <button
            type="button"
            className={ui.isVideoMuted ? css.ctrl : css.ctrlActive}
            onClick={() => actions.toggleVideo()}
            aria-label={cameraTitle}
            aria-pressed={ui.isVideoMuted}
          >
            {ui.isVideoMuted ? (
              <VideoCameraSlashIcon size={20} />
            ) : (
              <VideoCameraIcon size={20} weight="fill" />
            )}
          </button>
        </Tooltip>

        <Tooltip content={shareTitle}>
          <button
            type="button"
            className={ui.isScreenSharing ? css.ctrlActive : css.ctrl}
            onClick={() => actions.toggleScreenshare()}
            aria-label={shareTitle}
            aria-pressed={ui.isScreenSharing}
          >
            <MonitorArrowUpIcon size={20} weight={ui.isScreenSharing ? 'fill' : 'regular'} />
          </button>
        </Tooltip>
      </div>

      <span className={css.divider} />

      <div className={css.group}>
        {(isVoiceCall || view === 'fullscreen') && (
          <Tooltip content={chatTitle}>
            <button
              type="button"
              className={chatOpen ? css.ctrlAccent : css.ctrl}
              onClick={toggleChat}
              aria-label={chatTitle}
              aria-pressed={chatOpen}
            >
              <ChatTextIcon size={20} />
            </button>
          </Tooltip>
        )}

        {(view === 'fullscreen' || view === 'docked') && !isMobileLayout() && (
          <Tooltip content={t('voice.popOut')}>
            <button
              type="button"
              className={css.ctrl}
              onClick={popOut}
              aria-label={t('voice.popOut')}
            >
              <ArrowSquareOutIcon size={20} />
            </button>
          </Tooltip>
        )}

        {view === 'docked' && (
          <Tooltip content={t('voice.fullscreen')}>
            <button
              type="button"
              className={css.ctrl}
              onClick={() => actions.setPresentation('fullscreen')}
              aria-label={t('voice.fullscreen')}
            >
              <ArrowsOutIcon size={20} />
            </button>
          </Tooltip>
        )}

        {view === 'fullscreen' && !isVoiceCall && (
          <Tooltip content={t('voice.exitFullscreen')}>
            <button
              type="button"
              className={css.ctrl}
              onClick={() => actions.setPresentation('room')}
              aria-label={t('voice.exitFullscreen')}
            >
              <ArrowsInIcon size={20} />
            </button>
          </Tooltip>
        )}

        {view === 'tile' && (
          <Tooltip content={t('voice.returnToCall')}>
            <button
              type="button"
              className={css.ctrl}
              onClick={returnToCall}
              aria-label={t('voice.returnToCall')}
            >
              <ArrowSquareInIcon size={20} />
            </button>
          </Tooltip>
        )}

        <span ref={menuBtnRef} className={css.menuAnchor}>
          <Tooltip content={t('voice.moreOptions')}>
            <button
              type="button"
              className={menuOpen ? css.ctrlAccent : css.ctrl}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t('voice.moreOptions')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <DotsThreeVerticalIcon size={20} weight="bold" />
            </button>
          </Tooltip>
        </span>

        <Tooltip content={t('voice.hangup')}>
          <button
            type="button"
            className={css.ctrlDanger}
            onClick={() => actions.hangup()}
            aria-label={t('voice.hangup')}
          >
            <PhoneXIcon size={20} />
          </button>
        </Tooltip>
      </div>

      <Popover
        open={menuOpen}
        onClose={closeMenu}
        anchorRef={menuBtnRef}
        placement="top"
        role="menu"
        dense
      >
        <div className={css.menu}>
          <button
            type="button"
            role="menuitem"
            className={css.menuItem}
            onClick={() => {
              actions.openSettings();
              closeMenu();
            }}
          >
            <GearIcon size={16} />
            <span className={css.menuItemLabel}>{t('common.settings')}</span>
            <span className={css.menuItemSpacer} />
          </button>
        </div>
      </Popover>
    </div>
  );
}
