import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { IPublicRoomsChunkRoom } from 'matrix-js-sdk';
import {
  MagnifyingGlassIcon,
  XIcon,
  CompassIcon,
  UsersIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { LogoHover } from '@/app/components/AppLoading';
import { currentRoomIdAtom, exploreOpenAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Dialog } from '@/app/components/Dialog/Dialog';
import * as css from './ExploreModal.css';

type ExploreTab = 'featured' | 'server' | 'other';
type RoomFilter = 'all' | 'spaces' | 'rooms';

function getHueFromName(name: string): number {
  const code = (name || '?').codePointAt(0) ?? 63;
  return Math.round((code * 137.508) % 360);
}

function formatMembers(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

interface RoomCardProps {
  roomId: string;
  name: string;
  alias?: string | null;
  topic?: string | null;
  avatarUrl?: string | null;
  members: number;
  isSpace: boolean;
  isJoined: boolean;
  onJoin: (roomIdOrAlias: string, key: string) => void;
  joiningId: string | null;
}

function RoomCard({
  roomId,
  name,
  alias,
  topic,
  avatarUrl,
  members,
  isSpace,
  isJoined,
  onJoin,
  joiningId,
}: RoomCardProps) {
  const { t } = useTranslation();
  const hue = getHueFromName(name);
  const key = alias ?? roomId;
  const isJoining = joiningId === key;

  return (
    <div className={css.roomCard}>
      <div className={css.cardTop}>
        <div
          className={css.cardAvatar}
          style={
            avatarUrl
              ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover' }
              : { backgroundColor: `hsl(${hue}, 55%, 42%)` }
          }
        >
          {!avatarUrl && name.charAt(0).toUpperCase()}
        </div>
        <div className={css.cardInfo}>
          <div className={css.cardName} title={name}>
            {name}
          </div>
          {alias && <div className={css.cardAlias}>{alias}</div>}
        </div>
        <span className={css.cardTypeBadge}>
          {isSpace ? t('explore.typeSpace') : t('explore.typeRoom')}
        </span>
      </div>

      {topic && <p className={css.cardTopic}>{topic}</p>}

      <div className={css.cardFooter}>
        <span className={css.cardMembers}>
          <UsersIcon size={12} />
          {formatMembers(members)} {t('explore.members')}
        </span>
        {isJoined ? (
          <span className={css.joinedBadge}>{t('explore.joined')}</span>
        ) : (
          <button
            type="button"
            className={css.joinBtn}
            disabled={isJoining}
            onClick={() => onJoin(roomId, key)}
          >
            {isJoining ? t('explore.joining') : t('explore.join')}
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className={css.skeletonGrid}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className={css.skeletonCard} />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={css.emptyState}>
      <LogoHover size={60} />
      <p className={css.emptyTitle}>{title}</p>
      <p className={css.emptyBody}>{body}</p>
    </div>
  );
}

// How many rooms to request per page.
const PAGE_SIZE = 15;
const PAGE_SIZE_FILTERED = 60; // fetch more when filtering client-side
const PAGE_SIZE_FEATURED = 60; // featured tab pulls a larger directory slice
const FEATURED_LIMIT = 30; // ...but only surfaces the most popular spaces

export function ExploreModal() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const navigate = useNavigate();
  const [open, setOpen] = useAtom(exploreOpenAtom);
  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const toast = useToast();

  const homeDomain = client?.getDomain() ?? 'your server';

  const [activeTab, setActiveTab] = useState<ExploreTab>('featured');
  const [otherInput, setOtherInput] = useState('');
  const [otherServer, setOtherServer] = useState('');
  const otherInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<RoomFilter>('all');

  // pageHistory[i] = the `since` token needed to fetch page i.
  // pageHistory[0] is always undefined (first page has no since token).
  const [pageHistory, setPageHistory] = useState<Array<string | undefined>>([undefined]);
  const [currentPage, setCurrentPage] = useState(0); // 0-indexed

  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState(() => new Set<string>());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFeatured = activeTab === 'featured';
  const queryServer =
    activeTab === 'server' ? homeDomain : activeTab === 'other' ? otherServer : 'matrix.org';

  const roomsQuery = useQuery({
    queryKey: [
      'publicRooms',
      queryServer,
      isFeatured,
      debouncedQuery,
      filter,
      pageHistory[currentPage],
    ],
    queryFn: async () => {
      if (!client || !queryServer)
        return { chunk: [] as IPublicRoomsChunkRoom[], nextBatch: undefined as string | undefined };
      const limit = isFeatured
        ? PAGE_SIZE_FEATURED
        : filter !== 'all'
          ? PAGE_SIZE_FILTERED
          : PAGE_SIZE;
      const roomFilter = {
        generic_search_term: debouncedQuery.trim() || undefined,
        ...(isFeatured ? { room_types: ['m.space'] } : {}),
      } as { generic_search_term?: string };
      const res = await client.publicRooms({
        limit,
        server: queryServer,
        filter: roomFilter,
        since: isFeatured ? undefined : pageHistory[currentPage],
      });
      let chunk = res.chunk ?? [];
      if (isFeatured) chunk = chunk.filter((r) => r.room_type === 'm.space');
      else if (filter === 'spaces') chunk = chunk.filter((r) => r.room_type === 'm.space');
      else if (filter === 'rooms') chunk = chunk.filter((r) => r.room_type !== 'm.space');
      return { chunk, nextBatch: res.next_batch };
    },
    enabled: !!client && !!queryServer,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const rooms = roomsQuery.data?.chunk ?? [];
  const featuredRooms = isFeatured
    ? rooms
        .slice()
        .sort((a, b) => (b.num_joined_members ?? 0) - (a.num_joined_members ?? 0))
        .slice(0, FEATURED_LIMIT)
    : rooms;
  const nextBatch = roomsQuery.data?.nextBatch;
  const loading = roomsQuery.isFetching;
  const error = roomsQuery.error ? getErrorMessage(roomsQuery.error) : null;

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (activeTab === 'featured') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(val);
      setPageHistory([undefined]);
      setCurrentPage(0);
    }, 400);
  };

  const handleNextPage = () => {
    if (!nextBatch) return;
    const newPage = currentPage + 1;
    setPageHistory((prev) => {
      const next = [...prev];
      next[newPage] = nextBatch;
      return next;
    });
    setCurrentPage(newPage);
  };

  const handlePrevPage = () => {
    if (currentPage === 0) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
  };

  const commitOtherServer = () => {
    const trimmed = otherInput.trim();
    if (!trimmed) return;
    setOtherServer(trimmed);
    setDebouncedQuery(query);
    setPageHistory([undefined]);
    setCurrentPage(0);
  };

  const handleOtherKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitOtherServer();
  };

  // When clicking the "other" pill, focus its input
  const handleOtherPillClick = () => {
    setActiveTab('other');
    setQuery('');
    setDebouncedQuery('');
    setFilter('all');
    setPageHistory([undefined]);
    setCurrentPage(0);
    setTimeout(() => otherInputRef.current?.focus(), 50);
  };

  const handleJoin = useCallback(
    async (roomIdOrAlias: string, key: string) => {
      if (!client) return;
      setJoiningId(key);
      try {
        const room = await client.joinRoom(roomIdOrAlias);
        const joinedRoomId = room.roomId;
        setJoinedIds((prev) => {
          const next = new Set(prev);
          next.add(key);
          next.add(joinedRoomId);
          return next;
        });
        toast.success(t('explore.joinSuccess', { name: room.name ?? roomIdOrAlias }));
        setCurrentRoomId(joinedRoomId);
        setOpen(false);
        navigate(`/r/${encodeURIComponent(joinedRoomId)}`);
      } catch (err) {
        toast.error(t('explore.joinFailed', { error: getErrorMessage(err) }));
      } finally {
        setJoiningId(null);
      }
    },
    [client, navigate, setCurrentRoomId, setOpen, toast, t]
  );

  const isRoomJoined = useCallback(
    (roomId: string, alias?: string | null): boolean => {
      if (joinedIds.has(roomId)) return true;
      if (alias && joinedIds.has(alias)) return true;
      if (!client) return false;
      const localRoom = client.getRoom(roomId);
      return !!(localRoom && localRoom.getMyMembership() === 'join');
    },
    [client, joinedIds]
  );

  // Reset state when closing
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setActiveTab('featured');
      setQuery('');
      setDebouncedQuery('');
      setFilter('all');
      setOtherInput('');
      setOtherServer('');
      setPageHistory([undefined]);
      setCurrentPage(0);
    }, 200);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      zIndex={8000}
      maxWidth="1000px"
      height="85vh"
      className={css.dialog}
      bodyClassName={css.dialogBody}
      ariaLabel={t('explore.title')}
    >
      {/* ── Header ── */}
      <div className={css.header}>
        <div className={css.headerTop}>
          <span className={css.headerTitle}>
            <span className={css.headerTitleIcon}>
              <CompassIcon size={18} weight="fill" />
            </span>
            {t('explore.title')}
          </span>
          <button
            type="button"
            className={css.closeBtn}
            onClick={handleClose}
            aria-label={t('common.close')}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* ── Controls row ── */}
        <div className={css.controlsRow}>
          {/* Server pill switcher */}
          <div className={css.pillGroup}>
            {/* Featured pill */}
            <button
              type="button"
              className={activeTab === 'featured' ? css.pillActive : css.pill}
              onClick={() => {
                setActiveTab('featured');
                setQuery('');
                setFilter('all');
                setPageHistory([undefined]);
                setCurrentPage(0);
              }}
            >
              {t('explore.tabFeatured')}
            </button>

            {/* Home server pill */}
            <button
              type="button"
              className={activeTab === 'server' ? css.pillActive : css.pill}
              onClick={() => {
                setActiveTab('server');
                setQuery('');
                setDebouncedQuery('');
                setFilter('all');
                setPageHistory([undefined]);
                setCurrentPage(0);
              }}
            >
              {homeDomain}
            </button>

            {/* Other server: editable pill */}
            <div
              className={activeTab === 'other' ? css.pillOtherWrapperActive : css.pillOtherWrapper}
              onClick={activeTab !== 'other' ? handleOtherPillClick : undefined}
            >
              <input
                ref={otherInputRef}
                className={activeTab === 'other' ? css.pillOtherInputActive : css.pillOtherInput}
                value={otherInput}
                onChange={(e) => setOtherInput(e.target.value)}
                onKeyDown={handleOtherKeyDown}
                onFocus={() => activeTab !== 'other' && handleOtherPillClick()}
                placeholder={activeTab === 'other' ? 'mozilla.org' : t('explore.tabOther')}
                spellCheck={false}
              />
              {activeTab === 'other' && otherInput.trim() && (
                <button
                  type="button"
                  className={css.pillGoBtn}
                  onClick={commitOtherServer}
                  aria-label={t('explore.go')}
                >
                  <ArrowRightIcon size={13} weight="bold" />
                </button>
              )}
            </div>
          </div>

          {/* Search + filter — slide in from left when not on featured tab */}
          <div
            className={
              activeTab !== 'featured' ? css.searchFilterSlotVisible : css.searchFilterSlotHidden
            }
          >
            <div className={css.searchWrapper}>
              <span className={css.searchIcon}>
                <MagnifyingGlassIcon size={14} />
              </span>
              <input
                className={css.searchInput}
                value={query}
                onChange={handleQueryChange}
                placeholder={t('explore.searchPlaceholder')}
                spellCheck={false}
                tabIndex={activeTab !== 'featured' ? 0 : -1}
              />
            </div>
            <select
              className={css.filterSelect}
              value={filter}
              onChange={(e) => {
                const newFilter = e.target.value as RoomFilter;
                setFilter(newFilter);
                setPageHistory([undefined]);
                setCurrentPage(0);
              }}
              tabIndex={activeTab !== 'featured' ? 0 : -1}
            >
              <option value="all">{t('explore.filterAll')}</option>
              <option value="spaces">{t('explore.filterSpaces')}</option>
              <option value="rooms">{t('explore.filterRooms')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={css.scrollArea}>
        {/* Featured tab */}
        {activeTab === 'featured' &&
          (loading && !featuredRooms.length ? (
            <SkeletonGrid />
          ) : error ? (
            <div className={css.errorBanner}>{t('explore.fetchError', { error })}</div>
          ) : featuredRooms.length === 0 ? (
            <EmptyState title={t('explore.noResults')} body={t('explore.noResultsBody')} />
          ) : (
            <>
              <p className={css.sectionTitle}>{t('explore.featuredSpaces')}</p>
              <div className={css.roomGrid}>
                {featuredRooms.map((room) => (
                  <RoomCard
                    key={room.room_id}
                    roomId={room.room_id}
                    name={room.name ?? room.canonical_alias ?? room.room_id}
                    alias={room.canonical_alias}
                    topic={room.topic}
                    avatarUrl={
                      room.avatar_url && client
                        ? (client.mxcUrlToHttp(room.avatar_url, 48, 48, 'crop') ?? undefined)
                        : undefined
                    }
                    members={room.num_joined_members}
                    isSpace={room.room_type === 'm.space'}
                    isJoined={isRoomJoined(room.room_id, room.canonical_alias)}
                    onJoin={handleJoin}
                    joiningId={joiningId}
                  />
                ))}
              </div>
            </>
          ))}

        {/* Server / Other tabs */}
        {(activeTab === 'server' || activeTab === 'other') && (
          <>
            {/* Waiting for server input */}
            {activeTab === 'other' && !otherServer && !loading && (
              <EmptyState title={t('explore.emptyTitle')} body={t('explore.emptyBody')} />
            )}

            {error && <div className={css.errorBanner}>{t('explore.fetchError', { error })}</div>}

            {loading && !rooms.length && <SkeletonGrid />}

            {rooms.length > 0 && (activeTab === 'server' || otherServer) && (
              <>
                <p className={css.sectionTitle}>
                  {t('explore.publicRoomsOn', {
                    server: activeTab === 'server' ? homeDomain : otherServer,
                  })}
                </p>
                <div className={css.roomGrid}>
                  {rooms.map((room) => (
                    <RoomCard
                      key={room.room_id}
                      roomId={room.room_id}
                      name={room.name ?? room.canonical_alias ?? room.room_id}
                      alias={room.canonical_alias}
                      topic={room.topic}
                      avatarUrl={
                        room.avatar_url && client
                          ? (client.mxcUrlToHttp(room.avatar_url, 48, 48, 'crop') ?? undefined)
                          : undefined
                      }
                      members={room.num_joined_members}
                      isSpace={room.room_type === 'm.space'}
                      isJoined={isRoomJoined(room.room_id, room.canonical_alias)}
                      onJoin={handleJoin}
                      joiningId={joiningId}
                    />
                  ))}
                </div>
                {(currentPage > 0 || nextBatch) && (
                  <div className={css.paginationRow}>
                    <button
                      type="button"
                      className={css.pageBtn}
                      onClick={handlePrevPage}
                      disabled={currentPage === 0 || loading}
                    >
                      <ArrowLeftIcon size={14} weight="bold" />
                      {t('explore.prevPage')}
                    </button>
                    <span className={css.pageIndicator}>
                      {t('explore.pageOf', { page: currentPage + 1 })}
                    </span>
                    <button
                      type="button"
                      className={css.pageBtn}
                      onClick={handleNextPage}
                      disabled={!nextBatch || loading}
                    >
                      {t('explore.nextPage')}
                      <ArrowRightIcon size={14} weight="bold" />
                    </button>
                  </div>
                )}
              </>
            )}

            {!loading &&
              !error &&
              rooms.length === 0 &&
              (activeTab === 'server' || otherServer) && (
                <EmptyState title={t('explore.noResults')} body={t('explore.noResultsBody')} />
              )}
          </>
        )}
      </div>
    </Dialog>
  );
}
