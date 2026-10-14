import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { TrayIcon, HashStraightIcon, StackIcon, ChecksIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { Avatar } from '@/app/components/Avatar';
import { Popover } from '@/app/components/Popover/Popover';
import { inboxOpenAtom } from '@/app/store/atoms';
import { sendReadReceiptsAtom } from '@/app/store/atoms/settings';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { formatRelativeTime } from '@/util/format';
import { acceptInvite, declineInvite } from '@/app/features/room/inviteActions';
import { markRoomsAsRead } from '@/app/pages/client/spaceContextMenu';
import { useInvites, type Invite } from './useInvites';
import { useMentions, useHasUnreadMentions } from './useMentions';
import * as css from './Inbox.css';
import { vars } from '@/theme/vars.css';

type Tab = 'invites' | 'mentions';

const ROUTE_PREFIX: Record<Invite['kind'], string> = {
  room: '/r/',
  dm: '/dm/',
  space: '/space/',
};

export function Inbox() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const client = getMatrixClientOrNull();
  const anchorRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useAtom(inboxOpenAtom);
  const [tab, setTab] = useState<Tab>('invites');
  const [busyId, setBusyId] = useState<string | null>(null);
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);

  const invites = useInvites();
  const { mentions, refresh: refreshMentions } = useMentions(open);
  const hasUnreadMentions = useHasUnreadMentions();

  const activeCount = tab === 'invites' ? invites.length : mentions.length;
  const showBadge = invites.length > 0 || hasUnreadMentions;

  const handleMarkRead = (roomId: string) => {
    if (!client) return;
    markRoomsAsRead(client, sendReadReceipts, [roomId]);
    refreshMentions();
  };

  const handleMarkAllRead = () => {
    if (!client) return;
    const roomIds = [...new Set(mentions.map((m) => m.roomId))];
    markRoomsAsRead(client, sendReadReceipts, roomIds);
    refreshMentions();
  };

  const handleAccept = async (invite: Invite) => {
    if (!client || busyId) return;
    setBusyId(invite.roomId);
    try {
      await acceptInvite(client, invite.roomId);
      setOpen(false);
      navigate(ROUTE_PREFIX[invite.kind] + encodeURIComponent(invite.roomId));
    } catch (err) {
      toast.error(t('invite.acceptFailed', { error: getErrorMessage(err) }));
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (invite: Invite) => {
    if (!client) return;
    setBusyId(invite.roomId);
    try {
      await declineInvite(client, invite.roomId);
    } catch (err) {
      toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div ref={anchorRef} className={css.anchor}>
        <Tooltip placement="right" content={t('inbox.title')}>
          <button
            type="button"
            className={open ? css.inboxButtonActive : css.inboxButton}
            style={{ color: !open && showBadge ? vars.color.textPrimary : undefined }}
            aria-label={t('inbox.title')}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={css.pill} />
            <TrayIcon size={20} weight={open ? 'fill' : 'regular'} />
            {showBadge && (
              <span className={hasUnreadMentions ? css.notifDotMention : css.notifDot} />
            )}
          </button>
        </Tooltip>
      </div>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        placement="right"
        shiftCrossAxis
        role="dialog"
        labelledBy="inbox-title"
        className={css.panel}
      >
        <div className={css.header}>
          <span id="inbox-title" className={css.title}>
            <TrayIcon size={18} weight="fill" className={css.titleIcon} />
            {t('inbox.title')}
          </span>
          {tab === 'mentions' && mentions.length > 0 && (
            <button type="button" className={css.headerAction} onClick={handleMarkAllRead}>
              {t('inbox.markAllRead')}
            </button>
          )}
        </div>

        <div className={css.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'invites'}
            className={tab === 'invites' ? css.tabActive : css.tab}
            onClick={() => setTab('invites')}
          >
            {t('inbox.tabInvites')}
            {invites.length > 0 && (
              <span className={tab === 'invites' ? css.tabCountAccent : css.tabCount}>
                {invites.length > 99 ? '99+' : invites.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mentions'}
            className={tab === 'mentions' ? css.tabActive : css.tab}
            onClick={() => setTab('mentions')}
          >
            {t('inbox.tabMentions')}
            {mentions.length > 0 && (
              <span className={tab === 'mentions' ? css.tabCountAccent : css.tabCount}>
                {mentions.length > 99 ? '99+' : mentions.length}
              </span>
            )}
          </button>
        </div>

        <div className={css.content}>
          {activeCount === 0 ? (
            <div className={css.empty}>
              {tab === 'invites' ? t('inbox.emptyInvites') : t('inbox.emptyMentions')}
            </div>
          ) : tab === 'invites' ? (
            invites.map((invite) => {
              const inviterName = invite.inviterDisplayName ?? t('invite.unknownInviter');
              const KindIcon = invite.kind === 'space' ? StackIcon : HashStraightIcon;
              const when = invite.ts != null ? formatRelativeTime(invite.ts, t, i18n.language) : '';
              return (
                <div key={invite.roomId} className={css.inviteItem}>
                  <Avatar
                    name={invite.name}
                    mxcUrl={invite.avatarMxc}
                    client={client ?? undefined}
                    size="sm"
                  />
                  <div className={css.info}>
                    <span className={css.name}>
                      <span className={css.kindPrefix}>
                        {invite.kind === 'dm' ? '@' : <KindIcon size={13} weight="regular" />}
                      </span>
                      {invite.name}
                    </span>
                    <span className={css.subRow}>
                      <span className={css.sub}>{t('inbox.invitedBy', { name: inviterName })}</span>
                      {when && <span className={css.time}>{when}</span>}
                    </span>
                  </div>
                  <div className={css.actions}>
                    <button
                      type="button"
                      className={css.acceptButton}
                      disabled={busyId === invite.roomId}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleAccept(invite);
                      }}
                    >
                      {t('invite.accept')}
                    </button>
                    <button
                      type="button"
                      className={css.declineButton}
                      disabled={busyId === invite.roomId}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDecline(invite);
                      }}
                    >
                      {t('invite.decline')}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            mentions.map((mention) => (
              <div
                key={mention.eventId || `${mention.roomId}:${mention.ts}`}
                className={css.item}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  navigate(ROUTE_PREFIX.room + encodeURIComponent(mention.roomId));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen(false);
                    navigate(ROUTE_PREFIX.room + encodeURIComponent(mention.roomId));
                  }
                }}
              >
                <Avatar
                  name={mention.roomName}
                  mxcUrl={mention.roomAvatarMxc}
                  client={client ?? undefined}
                  size="sm"
                />
                <div className={css.info}>
                  <span className={css.name}>{mention.roomName}</span>
                  <span className={css.sub}>
                    {mention.senderName}
                    {mention.body ? `: ${mention.body}` : ''}
                  </span>
                </div>
                <span className={css.entryMeta}>
                  <span className={css.time}>
                    {formatRelativeTime(mention.ts, t, i18n.language)}
                  </span>
                  <Tooltip placement="left" content={t('inbox.markRead')}>
                    <button
                      type="button"
                      className={css.markReadButton}
                      aria-label={t('inbox.markRead')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(mention.roomId);
                      }}
                    >
                      <ChecksIcon size={14} />
                    </button>
                  </Tooltip>
                </span>
              </div>
            ))
          )}
        </div>
      </Popover>
    </>
  );
}
