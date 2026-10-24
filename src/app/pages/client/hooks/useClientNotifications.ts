import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentRoomIdAtom } from '@/app/store/atoms';
import {
  notificationSoundsAtom,
  notificationBannersAtom,
  notificationSoundPackAtom,
  soundOverridesAtom,
  notificationSoundVolumeAtom,
} from '@/app/store/atoms/settings';
import {
  showBrowserNotification,
  getNotificationAvatar,
  playNotificationSound,
  getNotifLevelSync,
} from '@/app/hooks/useNotifications';
import { RoomEvent, MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import type { IRoomTimelineData } from 'matrix-js-sdk/lib/models/event-timeline-set';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId, isDmRoom } from '@/util/matrix';
import { isReplyToUser } from '@/util/mentions';
import { useSyncReady } from '@/app/hooks/useSync';
import { isDesktopMuted, isDesktopWindowHidden, isTauriMobile } from '@/util/desktop';
import { nativeSoundName } from '@/util/notificationSounds';
import { stripBase } from '@/util/publicUrl';
import { isTimelineAtBottom } from '@/util/timelineViewState';

/** When this page was loaded; anything older that arrives right after a reload is catch-up. */
const PAGE_LOAD_TS = Date.now();
/** How long after the first sync of a page load events count as catch-up. */
const CATCH_UP_WINDOW_MS = 15_000;

export function useClientNotifications() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const navigate = useNavigate();
  const notificationSounds = useAtomValue(notificationSoundsAtom);
  const [notificationBanners, setNotificationBanners] = useAtom(notificationBannersAtom);
  const syncReady = useSyncReady();

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const currentRoomIdRef = useRef<string | null>(null);
  const [currentRoomId] = useAtom(currentRoomIdAtom);
  currentRoomIdRef.current = currentRoomId;

  const notificationSoundsRef = useRef(notificationSounds);
  notificationSoundsRef.current = notificationSounds;

  const soundPack = useAtomValue(notificationSoundPackAtom);
  const soundOverrides = useAtomValue(soundOverridesAtom);
  const soundVolume = useAtomValue(notificationSoundVolumeAtom);
  const soundSettingsRef = useRef({
    pack: soundPack,
    overrides: soundOverrides,
    volume: soundVolume,
  });
  soundSettingsRef.current = {
    pack: soundPack,
    overrides: soundOverrides,
    volume: soundVolume,
  };

  const notificationBannersRef = useRef(notificationBanners);
  notificationBannersRef.current = notificationBanners;

  const tRef = useRef(t);
  tRef.current = t;

  const syncReadyRef = useRef(syncReady);
  syncReadyRef.current = syncReady;
  const syncReadyAtRef = useRef<number | null>(null);
  if (syncReady && syncReadyAtRef.current === null) syncReadyAtRef.current = Date.now();

  const pendingEncryptedRef = useRef<Set<string>>(new Set());
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  const notifyForEvent = useRef((event: MatrixEvent, room: Room) => {
    const mx = getMatrixClientOrNull();
    const myId = mx?.getUserId?.();
    if (event.getSender?.() === myId) return;
    if (event.getType?.() !== 'm.room.message') return;

    // After a reload the first sync replays what arrived while the page was gone, and the read
    // receipts for it land just after the events. Those were already seen or notified before
    // the reload, so they never notify.
    const readyAt = syncReadyAtRef.current;
    if (
      readyAt !== null &&
      Date.now() - readyAt < CATCH_UP_WINDOW_MS &&
      event.getTs?.() < PAGE_LOAD_TS
    ) {
      return;
    }

    // Never re-notify for something already read (e.g. on another device, or before a reload
    // that replays recent events) or already notified in this session.
    const eventId = event.getId?.();
    if (eventId) {
      if (myId && room.hasUserReadEvent(myId, eventId)) return;
      if (notifiedEventsRef.current.has(eventId)) return;
      if (notifiedEventsRef.current.size > 500) notifiedEventsRef.current.clear();
      notifiedEventsRef.current.add(eventId);
    }

    const actions = mx?.getPushActionsForEvent?.(event);
    if (!actions?.notify) {
      if (!mx || !myId || !isReplyToUser(event, room, myId)) return;
      if (getNotifLevelSync(mx, room.roomId) === 'mute') return;
    }

    // A minimised or unfocused window is not being looked at, even if the webview still reports
    // itself visible. Scrolled up in the open room means the new message is not being seen either.
    const isWindowActive =
      document.visibilityState === 'visible' && !isDesktopWindowHidden() && document.hasFocus();
    const isCurrentRoom = room.roomId === currentRoomIdRef.current;
    if (isWindowActive && isCurrentRoom && isTimelineAtBottom(room.roomId)) return;

    const senderId = event.getSender?.() ?? '';
    const senderName = room.getMember?.(senderId)?.name ?? senderId;
    const content = event.getContent?.() ?? {};
    const formattedBody = content.formatted_body as string | undefined;
    const hasSpoiler = formattedBody?.includes('data-mx-spoiler') ?? false;
    const body = hasSpoiler
      ? tRef.current('common.spoilerNotification')
      : ((content.body as string) ?? tRef.current('common.newMessage'));

    const isDm = isDmRoom(room, mx!);
    const priority = isDm || !!actions?.tweaks?.highlight;
    let nativeSoundPlays = false;
    if (!isWindowActive && notificationBannersRef.current) {
      const roomUrl = isDm
        ? `/dm/${encodeURIComponent(room.roomId)}`
        : `/r/${encodeURIComponent(room.roomId)}`;
      // The phone app plays the chosen sound with the notification itself (a backgrounded webview
      // cannot), so the page must not play it a second time.
      nativeSoundPlays = isTauriMobile();
      const nativeSound = nativeSoundName(
        soundSettingsRef.current,
        notificationSoundsRef.current && !isDesktopMuted(),
        priority
      );
      // A one-to-one DM is named after the sender, so "Alice in Alice" says nothing new; only
      // rooms and group DMs get the room name.
      const isOneToOne = isDm && room.getJoinedMemberCount() <= 2;
      const title = isOneToOne ? senderName : `${senderName} in ${room.name ?? room.roomId}`;
      getNotificationAvatar(mx!, room.getMember?.(senderId)?.getMxcAvatarUrl()).then((icon) =>
        showBrowserNotification(title, body, roomUrl, icon ?? undefined, nativeSound)
      );
    }
    if (!nativeSoundPlays) {
      playNotificationSound(notificationSoundsRef.current, soundSettingsRef.current, priority);
    }
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'navigateTo' && typeof event.data.url === 'string') {
        const url = new URL(event.data.url);
        navigateRef.current(stripBase(url.pathname) + url.search + url.hash);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const onOpenRoom = (url: string) => navigateRef.current(url);
    window.electronAPI?.onOpenRoom?.(onOpenRoom);
    window.electronAPI
      ?.getPendingRoom?.()
      .then((url) => {
        if (url) navigateRef.current(url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'notifications' }).then((status) => {
      const handler = () => {
        if (status.state !== 'granted') {
          setNotificationBanners(false);
        }
      };
      status.addEventListener('change', handler);
      return () => status.removeEventListener('change', handler);
    });
  }, [setNotificationBanners]);

  useEffect(() => {
    if (!client) return;

    const handleTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: IRoomTimelineData
    ) => {
      if (!room) return;
      if (!syncReadyRef.current) return;
      if (!data?.liveEvent) return;

      const type = event.getType?.();

      if (type === 'm.room.encrypted') {
        const id = event.getId?.();
        if (!id) return;
        pendingEncryptedRef.current.add(id);

        const onDecrypted = (decryptedEvent: MatrixEvent, err?: Error) => {
          event.off(MatrixEventEvent.Decrypted, onDecrypted);
          if (err || decryptedEvent.isDecryptionFailure?.()) return;
          const eventId = decryptedEvent.getId?.();
          if (!eventId || !pendingEncryptedRef.current.has(eventId)) return;
          pendingEncryptedRef.current.delete(eventId);
          notifyForEvent.current(decryptedEvent, room);
        };

        event.on(MatrixEventEvent.Decrypted, onDecrypted);
        return;
      }

      notifyForEvent.current(event, room);
    };

    client.on(RoomEvent.Timeline, handleTimeline);
    return () => {
      client.off(RoomEvent.Timeline, handleTimeline);
      pendingEncryptedRef.current.clear();
    };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const handleMembership = (room: Room, newMembership: string) => {
      if (!syncReadyRef.current) return;
      if (newMembership !== 'invite') return;
      const myId = client.getUserId();
      const myMember = myId ? room.getMember(myId) : null;
      const inviterUserId: string | null =
        myMember?.getDMInviter?.() ?? myMember?.events.member?.getSender() ?? null;
      const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
      const inviterName =
        inviterUser?.displayName ??
        (inviterUserId ? formatUserId(inviterUserId) : null) ??
        t('invite.unknownInviter');

      const msg = t('invite.receivedInviteSimple', { user: inviterName });

      if (
        (document.visibilityState !== 'visible' || isDesktopWindowHidden()) &&
        notificationBannersRef.current
      ) {
        showBrowserNotification(t('invite.newInvite'), msg);
      }
      playNotificationSound(notificationSoundsRef.current, soundSettingsRef.current, true);
    };
    client.on(RoomEvent.MyMembership, handleMembership);
    return () => {
      client.off(RoomEvent.MyMembership, handleMembership);
    };
  }, [client, t]);
}
