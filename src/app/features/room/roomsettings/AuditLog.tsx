import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChatsIcon,
  GearSixIcon,
  ShieldIcon,
  StackIcon,
  UserIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { Direction, RoomEvent } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { Button } from '@/app/components/Button';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  AUDIT_CATEGORIES,
  buildAuditLog,
  levelValue,
  type AuditCategory,
  type AuditEntry,
} from './auditEntries';
import * as layoutCss from '@/app/features/settings/Settings.css';
import * as css from './AuditLog.css';

const ICONS: Record<AuditCategory, PhosphorIcon> = {
  members: UserIcon,
  permissions: ShieldIcon,
  settings: GearSixIcon,
  rooms: ChatsIcon,
  roles: StackIcon,
};

const PAGE = 100;
/** Enough entries to fill the panel before the user asks for more. */
const WANT = 30;
const MAX_AUTO_PAGES = 6;

function canPaginate(room: Room): boolean {
  return room.getLiveTimeline().getPaginationToken(Direction.Backward) !== null;
}

/** Who changed what in this room (members, permissions, settings and, for a space, its rooms). */
export function AuditLogPanel({ room, client }: { room: Room; client: MatrixClient }) {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<AuditCategory | 'all'>('all');
  const loadingRef = useRef(false);

  useMatrixEvent(client, RoomEvent.Timeline, (ev: MatrixEvent, r?: Room) => {
    if (r?.roomId === room.roomId && ev.isState()) setVersion((v) => v + 1);
  });

  const entries = useMemo(
    () => buildAuditLog(room.getLiveTimeline().getEvents(), room),
    // `version` stands for "the timeline changed".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, version]
  );
  const shown = filter === 'all' ? entries : entries.filter((e) => e.category === filter);

  const loadOlder = useCallback(
    async (pages: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        for (let i = 0; i < pages && canPaginate(room); i += 1) {
          await client.paginateEventTimeline(room.getLiveTimeline(), {
            backwards: true,
            limit: PAGE,
          });
          const have = buildAuditLog(room.getLiveTimeline().getEvents(), room).length;
          if (have >= WANT && pages > 1) break;
        }
      } catch {
        // Offline or the server refused; the button tries again.
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setVersion((v) => v + 1);
      }
    },
    [client, room]
  );

  // Fill the panel when it opens.
  useEffect(() => {
    if (buildAuditLog(room.getLiveTimeline().getEvents(), room).length < WANT) {
      void loadOlder(MAX_AUTO_PAGES);
    }
    // Only on open (or when the room changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.roomId]);

  const describe = (entry: AuditEntry): string => {
    const values: Record<string, string> = { ...entry.values };
    if (entry.action === 'powerChanged') {
      const label = (raw: string) => {
        const { key, level } = levelValue(Number(raw));
        return key ? `${t(`room.settings.members.${key}`)} (${level})` : level;
      };
      values.from = label(values.from);
      values.to = label(values.to);
    }
    if (entry.action === 'joinRulesChanged') {
      values.rule = t(`room.settings.auditLog.rule.${values.rule}`, { defaultValue: values.rule });
    }
    return t(`room.settings.auditLog.action.${entry.action}`, values);
  };

  const formatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div>
      <h2 className={layoutCss.panelTitle}>{t('room.settings.auditLog.title')}</h2>
      <p className={layoutCss.settingNote}>{t('room.settings.auditLog.note')}</p>

      <div className={css.filters} role="group" aria-label={t('room.settings.auditLog.filter')}>
        {(['all', ...AUDIT_CATEGORIES] as const).map((category) => (
          <button
            key={category}
            type="button"
            className={filter === category ? css.chipActive : css.chip}
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
          >
            {t(`room.settings.auditLog.category.${category}`)}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <ul className={css.list} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((entry) => {
            const Icon = ICONS[entry.category];
            return (
              <li key={entry.id} className={css.row}>
                <Icon size={16} className={css.icon} aria-hidden />
                <span className={css.text}>
                  <span className={css.actor}>{entry.actor}</span> {describe(entry)}
                </span>
                <span className={css.time}>{formatter.format(entry.ts)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        !loading && <p className={css.footer}>{t('room.settings.auditLog.empty')}</p>
      )}

      <div className={css.footer}>
        {loading ? (
          t('room.settings.auditLog.loading')
        ) : canPaginate(room) ? (
          <Button variant="secondary" size="sm" onClick={() => void loadOlder(1)}>
            {t('room.settings.auditLog.loadOlder')}
          </Button>
        ) : (
          shown.length > 0 && t('room.settings.auditLog.start')
        )}
      </div>
    </div>
  );
}
