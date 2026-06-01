import { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CopyIcon, ChatCircleIcon, HardDrivesIcon } from '@phosphor-icons/react';
import { userProfileAtom } from '@/app/store/atoms/userProfile';
import { currentRoomIdAtom as roomAtom, sidebarViewAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { useToast } from '@/app/hooks/useToast';
import { startDm } from '@/app/hooks/useDms';
import { fetchMediaBlobUrl } from '@/app/components/Avatar/avatarCache';
import { getErrorMessage } from '@/util/error';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import * as css from './UserProfilePopup.css';

const POPUP_WIDTH = 280;
const POPUP_MARGIN = 12;

function computePosition(anchor: { top: number; left: number; width: number; height: number }) {
  const centerY = anchor.top + anchor.height / 2;
  const rightX = anchor.left + anchor.width + POPUP_MARGIN;
  const leftX = anchor.left - POPUP_WIDTH - POPUP_MARGIN;

  const preferRight = rightX + POPUP_WIDTH <= window.innerWidth - POPUP_MARGIN;
  const x = preferRight ? rightX : Math.max(POPUP_MARGIN, leftX);

  let y = centerY - 100;
  y = Math.max(POPUP_MARGIN, y);
  y = Math.min(y, window.innerHeight - 250 - POPUP_MARGIN);

  return { x, y };
}

export function UserProfilePopup() {
  const { t } = useTranslation();
  const [profileState, setProfileState] = useAtom(userProfileAtom);
  const [, setCurrentRoom] = useAtom(roomAtom);
  const setSidebarView = useSetAtom(sidebarViewAtom);
  const toast = useToast();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const popupRef = useRef<HTMLDivElement>(null);

  const profile = useUserProfile(client, profileState?.userId ?? null, profileState?.roomId);
  const myId = client?.getUserId();
  const isOwn = profileState?.userId === myId;

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [startingDm, setStartingDm] = useState(false);
  const [localPowerLevel, setLocalPowerLevel] = useState(profile?.powerLevel ?? 0);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Sync local power level when profile changes (e.g. different user)
  useEffect(() => {
    if (profile) setLocalPowerLevel(profile.powerLevel ?? 0);
  }, [profile]);

  const fitSelectWidth = useCallback((el: HTMLSelectElement) => {
    const selected = el.options[el.selectedIndex];
    if (!selected) return;
    const temp = document.createElement('span');
    temp.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    temp.style.font = getComputedStyle(el).font;
    temp.textContent = selected.textContent;
    document.body.appendChild(temp);
    el.style.width = `${temp.offsetWidth + 24}px`;
    document.body.removeChild(temp);
  }, []);

  // Fit width on mount when powerLevel changes (e.g. after role change)
  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;
    fitSelectWidth(el);
  }, [localPowerLevel, fitSelectWidth]);

  const handleClose = useCallback(() => {
    setProfileState(null);
  }, [setProfileState]);

  // Close on Escape
  useEffect(() => {
    if (!profileState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [profileState, handleClose]);

  const handleCopy = useCallback(() => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.userId).then(() => toast.success(t('common.copied')));
  }, [profile, toast, t]);

  const handleAvatarClick = useCallback(async () => {
    if (!profile?.avatarMxc || !client) return;
    const src = await fetchMediaBlobUrl(profile.avatarMxc, client);
    if (src) setLightboxSrc(src);
  }, [profile, client]);

  const handleStartDm = useCallback(async () => {
    if (!client || !profile) return;
    setStartingDm(true);
    try {
      const roomId = await startDm(client, profile.userId);
      setCurrentRoom(roomId);
      navigate(`/dm/${encodeURIComponent(roomId)}`);
      setSidebarView('dms');
      handleClose();
    } catch (err) {
      toast.error(t('room.dm.startFailed', { error: getErrorMessage(err) }));
    } finally {
      setStartingDm(false);
    }
  }, [client, profile, setCurrentRoom, navigate, handleClose, toast, t]);

  if (!profileState || !profile) return null;

  const pos = computePosition(profileState.anchorRect);

  const roleLabel =
    localPowerLevel >= 100
      ? t('room.members.admin')
      : localPowerLevel >= 50
        ? t('room.members.moderator')
        : t('room.members.member');
  const roleClass =
    localPowerLevel >= 100
      ? css.roleAdmin
      : localPowerLevel >= 50
        ? css.roleModerator
        : css.roleMember;

  return (
    <>
      <div className={css.overlay} onClick={handleClose} />
      <div
        ref={popupRef}
        className={css.popup}
        style={{ left: pos.x, top: pos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={css.topRow}>
          <div
            className={css.avatarWrap}
            onClick={handleAvatarClick}
            title={t('profile.viewFullScreen')}
          >
            <Avatar
              name={profile.displayName}
              mxcUrl={profile.avatarMxc}
              client={client ?? undefined}
              size="lg"
            />
          </div>

          <div className={css.nameSection}>
            <span className={css.displayName}>{profile.displayName}</span>

            <div className={css.userIdRow}>
              <span className={css.userId}>{profile.userId.split(':')[0]}</span>
              <IconButton size="xs" onClick={handleCopy} aria-label={t('common.copy')}>
                <CopyIcon size={12} />
              </IconButton>
            </div>
          </div>
        </div>

        <div className={css.infoRow}>
          <span className={css.infoIcon}>
            <HardDrivesIcon size={14} />
          </span>
          <span className={css.infoValue}>{profile.homeserver}</span>
          {profileState.roomId && !isOwn && profile.canModify ? (
            <select
              ref={selectRef}
              className={`${roleClass} ${css.roleSelect}`}
              value={localPowerLevel}
              onChange={async (e) => {
                if (!client || !profileState.roomId || !profile) return;
                const newLevel = Number(e.target.value);
                const prevLevel = localPowerLevel;
                setLocalPowerLevel(newLevel);
                try {
                  await client.setPowerLevel(profileState.roomId, profile.userId, newLevel);
                  toast.success(
                    t('room.settings.members.permissionsApplySuccess', {
                      name: profile.displayName,
                      level: e.target.options[e.target.selectedIndex].text,
                    })
                  );
                } catch (err) {
                  toast.error(
                    t('room.settings.members.permissionsApplyFailed', {
                      error: getErrorMessage(err),
                    })
                  );
                  setLocalPowerLevel(prevLevel);
                }
              }}
            >
              <option value={100}>{t('room.members.admin')}</option>
              <option value={50}>{t('room.members.moderator')}</option>
              <option value={0}>{t('room.members.member')}</option>
            </select>
          ) : (
            profileState.roomId && <span className={roleClass}>{roleLabel}</span>
          )}
        </div>

        {!isOwn && profileState.roomId && (
          <Button variant="primary" fullWidth loading={startingDm} onClick={handleStartDm}>
            <ChatCircleIcon size={16} />
            {t('profile.message')}
          </Button>
        )}
      </div>

      {lightboxSrc && (
        <MediaLightbox
          src={lightboxSrc}
          name={profile.displayName}
          client={client}
          avatarMxc={profile.avatarMxc}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  );
}
