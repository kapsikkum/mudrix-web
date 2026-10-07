import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  CheckIcon,
  DotsThreeVerticalIcon,
  GearIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  MonitorArrowUpIcon,
  PhoneXIcon,
  PresentationIcon,
  SmileyIcon,
  SquaresFourIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { Popover } from '@/app/components/Popover';
import {
  elementCallActionsAtom,
  elementCallEmbedAtom,
  elementCallUiAtom,
} from '@/app/store/atoms/elementCall';
import * as css from './CallControlBar.css';

export function CallControlBar() {
  const { t } = useTranslation();
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
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
        <span ref={menuBtnRef} className={css.menuAnchor}>
          <Tooltip content={t('voice.moreOptions')}>
            <button
              type="button"
              className={css.ctrl}
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
            role="menuitemradio"
            aria-checked={ui.isSpotlight}
            className={ui.isSpotlight ? css.menuItemActive : css.menuItem}
            onClick={() => {
              actions.setSpotlight(true);
              closeMenu();
            }}
          >
            <PresentationIcon size={16} />
            <span className={css.menuItemLabel}>{t('voice.spotlight')}</span>
            {ui.isSpotlight ? (
              <CheckIcon size={14} className={css.menuItemCheck} />
            ) : (
              <span className={css.menuItemSpacer} />
            )}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={!ui.isSpotlight}
            className={!ui.isSpotlight ? css.menuItemActive : css.menuItem}
            onClick={() => {
              actions.setSpotlight(false);
              closeMenu();
            }}
          >
            <SquaresFourIcon size={16} />
            <span className={css.menuItemLabel}>{t('voice.grid')}</span>
            {!ui.isSpotlight ? (
              <CheckIcon size={14} className={css.menuItemCheck} />
            ) : (
              <span className={css.menuItemSpacer} />
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            className={css.menuItem}
            onClick={() => {
              actions.openReactions();
              closeMenu();
            }}
          >
            <SmileyIcon size={16} />
            <span className={css.menuItemLabel}>{t('voice.reactions')}</span>
            <span className={css.menuItemSpacer} />
          </button>

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
