import { useState, useEffect, useCallback, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CopyIcon,
  ChatCircleIcon,
  HardDrivesIcon,
  CheckIcon,
  XIcon,
  SignOutIcon,
  ProhibitInsetIcon,
  CameraIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { userProfileAtom } from '@/app/store/atoms/userProfile';
import {
  currentRoomIdAtom as roomAtom,
  sidebarViewAtom,
  promptModalAtom,
  showPresenceAtom,
  presenceMapAtom,
  ownPresenceAtom,
} from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { getMatrixClient, getMatrixClientOrNull } from '@/client/initMatrix';
import { useUserProfile } from '@/app/hooks/useUserProfile';
import { useSyncReady } from '@/app/hooks/useSync';
import { useConfirm } from '@/app/hooks/useConfirm';
import { useUserBanner, useUserBannerBlob } from '@/app/hooks/useUserBanner';
import { useProfile } from '@/app/hooks/useProfile';
import { useBannerGradient } from '@/app/hooks/useBannerGradient';
import { useToast } from '@/app/hooks/useToast';
import { startDm } from '@/app/hooks/useDms';
import { fetchMediaBlobUrl, useAvatarBlobUrl } from '@/app/components/Avatar';
import { getErrorMessage } from '@/util/error';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import * as css from './UserProfilePopup.css';

import { roomStateMaybe } from '@/util/matrix';

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
  const setPrompt = useSetAtom(promptModalAtom);
  const toast = useToast();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const popupRef = useRef<HTMLDivElement>(null);

  const profile = useUserProfile(client, profileState?.userId ?? null, profileState?.roomId);
  const myId = client?.getUserId();
  const isOwn = profileState?.userId === myId;

  const { profile: ownProfile, saveProfile, removeAvatar } = useProfile(client!);
  const ownAvatarMxc =
    isOwn && ownProfile?.avatarUrl ? ownProfile.avatarUrl : (profile?.avatarMxc ?? null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const { banner, saveBanner, removeBanner } = useUserBanner(client, profileState?.userId ?? null);
  const { data: bannerSrc } = useUserBannerBlob(client, banner?.mxc);
  const { data: avatarBlob } = useAvatarBlobUrl(profile?.avatarMxc, client);
  const bannerGradient = useBannerGradient(avatarBlob, profile?.displayName ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [bannerLightboxOpen, setBannerLightboxOpen] = useState(false);

  const showPresence = useAtomValue(showPresenceAtom);
  const presenceMap = useAtomValue(presenceMapAtom);
  const ownPresence = useAtomValue(ownPresenceAtom);
  const syncReady = useSyncReady();
  const confirmDialog = useConfirm();

  const presence: PresenceState | undefined = (() => {
    if (!showPresence || !syncReady) return undefined;
    if (isOwn) return ownPresence;
    const uid = profileState?.userId;
    if (!uid) return undefined;
    return presenceMap[uid];
  })();

  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [startingDm, setStartingDm] = useState(false);
  const [localPowerLevel, setLocalPowerLevel] = useState(profile?.powerLevel ?? 0);

  // Sync local power level when profile changes (e.g. different user)
  useEffect(() => {
    if (profile) setLocalPowerLevel(profile.powerLevel ?? 0);
  }, [profile]);

  const handleClose = useCallback(() => {
    setProfileState(null);
  }, [setProfileState]);

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!client || !profileState) return;
    setApproving(true);
    try {
      const mx = getMatrixClient();
      await mx.invite(profileState.roomId!, profileState.userId!);
      toast.success(t('room.members.approveSuccess', { name: profileState.userId }));
      handleClose();
    } catch (err) {
      toast.error(t('room.members.approveFailed', { error: getErrorMessage(err) }));
    } finally {
      setApproving(false);
    }
  }, [client, profileState, handleClose, toast, t]);

  const handleReject = useCallback(async () => {
    if (!client || !profileState) return;
    setRejecting(true);
    try {
      const mx = getMatrixClient();
      await mx.kick(profileState.roomId!, profileState.userId!);
      toast.success(t('room.members.rejectSuccess', { name: profileState.userId }));
      handleClose();
    } catch (err) {
      toast.error(t('room.members.rejectFailed', { error: getErrorMessage(err) }));
    } finally {
      setRejecting(false);
    }
  }, [client, profileState, handleClose, toast, t]);

  const handleKick = useCallback(async () => {
    if (!client || !profileState || !profile) return;
    handleClose();
    const reason = await new Promise<string | null>((resolve) => {
      setPrompt({
        open: true,
        title: t('room.members.kickConfirm', { name: profile.displayName }),
        message: t('room.members.reasonLabel'),
        defaultValue: '',
        resolve,
      });
    });
    if (reason === null) return;
    try {
      await client.kick(profileState.roomId!, profile.userId, reason || undefined);
      toast.success(t('room.members.kickSuccess', { name: profile.displayName }));
    } catch (err) {
      toast.error(t('room.members.kickFailed', { error: getErrorMessage(err) }));
    }
  }, [client, profileState, profile, toast, t, handleClose, setPrompt]);

  const handleBan = useCallback(async () => {
    if (!client || !profileState || !profile) return;
    handleClose();
    const reason = await new Promise<string | null>((resolve) => {
      setPrompt({
        open: true,
        title: t('room.members.banConfirm', { name: profile.displayName }),
        message: t('room.members.reasonLabel'),
        defaultValue: '',
        resolve,
      });
    });
    if (reason === null) return;
    try {
      await client.ban(profileState.roomId!, profile.userId, reason || undefined);
      toast.success(t('room.members.banSuccess', { name: profile.displayName }));
    } catch (err) {
      toast.error(t('room.members.banFailed', { error: getErrorMessage(err) }));
    }
  }, [client, profileState, profile, toast, t, handleClose, setPrompt]);

  const handleRemoveMessages = useCallback(async () => {
    if (!client || !profileState || !profile) return;
    const roomId = profileState.roomId;
    if (!roomId) return;
    const targetUserId = profile.userId;
    const room = client.getRoom(roomId);
    if (!room) return;

    const events = room.getLiveTimeline().getEvents();
    const targetEvents = events.filter((e) => e.getSender() === targetUserId && !e.isRedacted());

    const messageCount = targetEvents.filter(
      (e) =>
        e.getType() === 'm.room.message' ||
        e.getType() === 'm.sticker' ||
        e.getType() === 'm.room.encrypted'
    ).length;

    const totalCount = messageCount;

    if (totalCount === 0) {
      toast.info(t('profile.noMessagesToRemove'));
      return;
    }

    const ok = await confirmDialog({
      title: t('profile.removeMessagesConfirmTitle', { name: profile.displayName }),
      message: t('profile.removeMessagesConfirmBody', {
        count: totalCount,
        name: profile.displayName,
      }),
      danger: true,
      confirmLabel: t('profile.removeMessagesConfirmButton', { count: totalCount }),
    });

    if (!ok) return;

    try {
      const eventsToRedact = targetEvents.filter((e) => {
        const type = e.getType();
        return type === 'm.room.message' || type === 'm.sticker' || type === 'm.room.encrypted';
      });

      await Promise.all(
        eventsToRedact.map(async (e) => {
          const eventId = e.getId();
          if (eventId) {
            await client.redactEvent(roomId, eventId);
          }
        })
      );

      toast.success(t('profile.messagesRemoved', { count: eventsToRedact.length }));
    } catch (err) {
      toast.error(t('profile.removeMessagesFailed', { error: getErrorMessage(err) }));
    }
  }, [client, profileState, profile, toast, t, confirmDialog]);

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
    if (!client) return;
    if (isOwn && !ownAvatarMxc) {
      avatarFileRef.current?.click();
      return;
    }
    if (!ownAvatarMxc) return;
    setAvatarSrc(avatarBlob ?? null);
    setAvatarLightboxOpen(true);
    const full = await fetchMediaBlobUrl(ownAvatarMxc, client);
    if (full) setAvatarSrc(full);
  }, [client, isOwn, ownAvatarMxc, avatarBlob]);

  const handleAvatarFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !client) return;
      e.target.value = '';
      try {
        await saveProfile({ avatarFile: file });
        toast.success(t('common.saved'));
      } catch (err) {
        toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, saveProfile, toast, t]
  );

  const handleRemoveOwnAvatar = useCallback(async () => {
    const ok = await confirmDialog({
      title: t('common.removeAvatar'),
      message: t('common.removeAvatarConfirm'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeAvatar();
      toast.success(t('common.avatarRemoved'));
    } catch (err) {
      toast.error(t('common.removeAvatarFailed', { error: getErrorMessage(err) }));
    }
  }, [confirmDialog, removeAvatar, toast, t]);

  const handleBannerEdit = useCallback(() => {
    if (!client || !profileState) return;
    fileRef.current?.click();
  }, [client, profileState]);

  const handleBannerClick = useCallback(() => {
    if (!client) return;
    if (banner?.canModify) {
      if (banner.mxc) {
        setBannerLightboxOpen(true);
      } else {
        handleBannerEdit();
      }
      return;
    }
    if (!banner?.mxc) return;
    setBannerLightboxOpen(true);
  }, [banner, client, handleBannerEdit]);

  const handleBannerFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !profileState) return;
      try {
        await saveBanner({ userId: profileState.userId, file });
        toast.success(t('profile.bannerSaved'));
      } catch (err) {
        toast.error(t('profile.bannerSaveFailed', { error: getErrorMessage(err) }));
      } finally {
        e.target.value = '';
      }
    },
    [profileState, saveBanner, toast, t]
  );

  const handleBannerRemove = useCallback(async () => {
    if (!profileState) return;
    const ok = await confirmDialog({
      title: t('profile.removeBanner'),
      message: t('profile.removeBannerConfirm'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeBanner({ userId: profileState.userId });
      setBannerLightboxOpen(false);
      toast.success(t('profile.bannerRemoved'));
    } catch (err) {
      toast.error(t('profile.bannerRemoveFailed', { error: getErrorMessage(err) }));
    }
  }, [profileState, confirmDialog, removeBanner, toast, t]);

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

  const room = profileState.roomId ? client?.getRoom(profileState.roomId) : null;
  const targetMember = profileState.roomId ? room?.getMember(profileState.userId) : null;
  const isKnock = targetMember?.membership === 'knock';
  const myPowerLevel = room?.getMember(myId ?? '')?.powerLevel ?? 0;
  const canModerate = myPowerLevel >= 50;
  const powerLevelsEvent = roomStateMaybe(room)?.getStateEvents('m.room.power_levels', '');
  const plContent = powerLevelsEvent?.getContent() ?? {};
  const kickThreshold = plContent.kick ?? 50;
  const banThreshold = plContent.ban ?? 50;
  const targetPowerLevel = profile?.powerLevel ?? 0;
  const canKick =
    !isOwn && !isKnock && myPowerLevel >= kickThreshold && myPowerLevel > targetPowerLevel;
  const canBan =
    !isOwn && !isKnock && myPowerLevel >= banThreshold && myPowerLevel > targetPowerLevel;
  const redactThreshold = plContent.redact ?? 50;
  const canRedactAny = !isOwn && myPowerLevel >= redactThreshold && myPowerLevel > targetPowerLevel;

  const pos = computePosition(profileState.anchorRect);

  const bannerClickable = isOwn || !!banner?.mxc;

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
      <div className={css.overlay} role="presentation" onClick={handleClose} />
      <div
        ref={popupRef}
        className={css.popup}
        style={{ left: pos.x, top: pos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={css.coverWrap}
          onClick={handleBannerClick}
          style={bannerClickable ? { cursor: 'pointer' } : undefined}
        >
          {banner?.mxc && bannerSrc ? (
            <img src={bannerSrc} alt="" className={css.cover} />
          ) : banner?.mxc ? (
            <div className={css.coverNeutral} />
          ) : (
            <div className={css.coverFallback} style={{ background: bannerGradient }} />
          )}
          {banner?.canModify && (
            <div className={css.coverEdit}>
              <CameraIcon size={14} />
            </div>
          )}
        </div>

        <div className={css.topRow}>
          {ownAvatarMxc ? (
            <Tooltip content={t('profile.viewFullScreen')}>
              <div className={css.avatarWrap} onClick={handleAvatarClick}>
                <Avatar
                  name={profile.displayName}
                  mxcUrl={ownAvatarMxc}
                  client={client ?? undefined}
                  size="lg"
                  presence={presence}
                />
              </div>
            </Tooltip>
          ) : (
            <div
              className={`${css.avatarWrap}${isOwn ? ` ${css.avatarWrapEditable}` : ''}`}
              onClick={handleAvatarClick}
            >
              <Avatar
                name={profile.displayName}
                mxcUrl={ownAvatarMxc}
                client={client ?? undefined}
                size="lg"
                presence={presence}
              />
              {isOwn && (
                <div className={css.avatarEdit}>
                  <CameraIcon size={16} />
                </div>
              )}
            </div>
          )}

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
            <div className={css.roleSelectWrap}>
              <span className={roleClass}>{roleLabel}</span>
              <select
                className={css.roleSelectHidden}
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
            </div>
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

        {!isOwn && profileState.roomId && canRedactAny && (
          <Button variant="danger" fullWidth onClick={handleRemoveMessages}>
            <XIcon size={16} />
            {t('profile.removeMessages')}
          </Button>
        )}

        {!isKnock && profileState.roomId && !isOwn && (canKick || canBan) && (
          <div className={css.modActions}>
            {canKick && (
              <Button variant="danger" className={css.modActionBtn} onClick={handleKick}>
                <SignOutIcon size={16} />
                {t('room.members.kick')}
              </Button>
            )}
            {canBan && (
              <Button variant="danger" className={css.modActionBtn} onClick={handleBan}>
                <ProhibitInsetIcon size={16} />
                {t('room.members.ban')}
              </Button>
            )}
          </div>
        )}

        {isKnock && canModerate && (
          <div className={css.modActions}>
            <Button
              variant="secondary"
              className={css.modActionBtn}
              loading={rejecting}
              onClick={handleReject}
            >
              <XIcon size={16} />
              {t('room.members.reject')}
            </Button>
            <Button
              variant="success"
              className={css.modActionBtn}
              loading={approving}
              onClick={handleApprove}
            >
              <CheckIcon size={16} />
              {t('room.members.approve')}
            </Button>
          </div>
        )}
      </div>

      {avatarLightboxOpen && (
        <MediaLightbox
          src={avatarSrc ?? undefined}
          name={profile.displayName}
          client={client}
          avatarMxc={ownAvatarMxc}
          onClose={() => setAvatarLightboxOpen(false)}
          onReplace={
            isOwn
              ? () => {
                  setAvatarLightboxOpen(false);
                  setTimeout(() => avatarFileRef.current?.click(), 100);
                }
              : undefined
          }
          onRemove={
            isOwn
              ? () => {
                  setAvatarLightboxOpen(false);
                  handleRemoveOwnAvatar();
                }
              : undefined
          }
        />
      )}

      {bannerLightboxOpen && (
        <MediaLightbox
          src={bannerSrc ?? undefined}
          name={profile.displayName}
          client={client}
          avatarMxc={ownAvatarMxc}
          onClose={() => setBannerLightboxOpen(false)}
          onReplace={
            banner?.canModify
              ? () => {
                  setBannerLightboxOpen(false);
                  setTimeout(() => handleBannerEdit(), 100);
                }
              : undefined
          }
          onRemove={
            banner?.canModify
              ? () => {
                  setBannerLightboxOpen(false);
                  handleBannerRemove();
                }
              : undefined
          }
        />
      )}

      {banner?.canModify && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={css.hiddenInput}
          onChange={handleBannerFileChange}
        />
      )}
      {isOwn && (
        <input
          ref={avatarFileRef}
          type="file"
          accept="image/*"
          className={css.hiddenInput}
          onChange={handleAvatarFileChange}
        />
      )}
    </>
  );
}
