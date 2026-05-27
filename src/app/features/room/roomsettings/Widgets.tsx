import { useState, useCallback, useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useTranslation } from 'react-i18next';
import {
  MicrophoneIcon,
  StickerIcon,
  PuzzlePieceIcon,
  PencilSimpleIcon,
  TrashIcon,
  CheckCircleIcon,
  PlusIcon,
  LockIcon,
} from '@phosphor-icons/react';
import { useAtom } from 'jotai';
import { Modal } from '@/app/components/Modal';
import { Button, IconButton } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useWidgets, WIDGET_TYPES } from '@/app/hooks/useWidgets';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { normalizeUrl } from '@/client/initMatrix';
import { confirmModalAtom } from '@/app/store/atoms';
import { WidgetEditorModal } from '../WidgetEditorModal';
import * as css from '../RoomSettingsWidgets.css';
import * as panelCss from '@/app/components/Settings/Settings.css';

const BUILTIN_WIDGETS = [
  {
    type: WIDGET_TYPES.JITSI_VOICE_CHANNEL,
    nameKey: 'room.settings.widgets.builtin.jitsi-voice-channel.name',
    descriptionKey: 'room.settings.widgets.builtin.jitsi-voice-channel.description',
    urlHelpKey: 'room.settings.widgets.builtin.jitsi-voice-channel.urlHelp',
    icon: <MicrophoneIcon size={18} />,
    defaultUrl: '',
    urlPlaceholder: 'meet.example.com',
  },
  {
    type: WIDGET_TYPES.STICKER_PICKER,
    nameKey: 'room.settings.widgets.builtin.m.stickerpicker.name',
    descriptionKey: 'room.settings.widgets.builtin.m.stickerpicker.description',
    urlHelpKey: 'room.settings.widgets.builtin.m.stickerpicker.urlHelp',
    icon: <StickerIcon size={18} />,
    defaultUrl: 'stickerpicker.wizardchat.org',
    urlPlaceholder: 'stickerpicker.wizardchat.org',
  },
];

interface AddBuiltinModalProps {
  open: boolean;
  title: string;
  defaultUrl?: string;
  urlPlaceholder?: string;
  urlHelp?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
}

function AddBuiltinModal({
  open,
  title,
  defaultUrl = '',
  urlPlaceholder = 'example.com/widget',
  urlHelp,
  saving,
  onClose,
  onSave,
}: AddBuiltinModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(defaultUrl);

  useEffect(() => {
    if (open) setUrl(defaultUrl);
  }, [open, defaultUrl]);

  const normalizedUrl = normalizeUrl(url);
  const canSave = normalizedUrl.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!canSave}
            onClick={() => onSave(normalizedUrl)}
          >
            {t('room.settings.widgets.addWidgetBtn')}
          </Button>
        </>
      }
    >
      <div className={css.modalField}>
        <label className={css.modalLabel}>{t('room.settings.widgets.urlLabel')}</label>
        <Input
          placeholder={urlPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
        {urlHelp && <span className={css.helpText}>{urlHelp}</span>}
      </div>
    </Modal>
  );
}

interface AddedRowProps {
  widget: RoomWidget;
  onEdit?: (widget: RoomWidget) => void;
  onDelete?: (widget: RoomWidget) => void;
  readOnly?: boolean;
}

function AddedRow({ widget, onEdit, onDelete, readOnly = false }: AddedRowProps) {
  const { t } = useTranslation();
  const builtin = BUILTIN_WIDGETS.find((b) => b.type === widget.type);
  const icon = builtin?.icon ?? <PuzzlePieceIcon size={18} />;
  const displayName = widget.name || (builtin?.nameKey ? t(builtin.nameKey) : '') || widget.type;

  return (
    <div className={css.widgetRow}>
      <div className={css.widgetRowIcon}>{icon}</div>
      <div className={css.widgetRowInfo}>
        <span className={css.widgetRowName}>{displayName}</span>
        <span className={css.widgetRowUrl}>{widget.type}</span>
      </div>
      {!readOnly && (
        <div className={css.widgetRowActions}>
          <IconButton
            size="sm"
            aria-label={t('room.settings.widgets.editWidget')}
            onClick={() => onEdit?.(widget)}
          >
            <PencilSimpleIcon size={14} />
          </IconButton>
          <IconButton
            size="sm"
            aria-label={t('room.settings.widgets.removeWidget')}
            onClick={() => onDelete?.(widget)}
          >
            <TrashIcon size={14} className={css.dangerIcon} />
          </IconButton>
        </div>
      )}
    </div>
  );
}

interface Props {
  roomId: string;
  client: MatrixClient;
}

type ModalMode =
  | { kind: 'add-builtin'; widgetType: string }
  | { kind: 'add-custom' }
  | { kind: 'edit'; widget: RoomWidget }
  | null;

export function Widgets({ roomId, client }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [, setConfirm] = useAtom(confirmModalAtom);
  const { widgets, addWidget, removeWidget } = useWidgets(client, roomId);

  const room = client?.getRoom(roomId) ?? null;
  const myUserId = client?.getUserId() ?? '';
  const isAdmin = (room?.getMember(myUserId)?.powerLevel ?? 0) >= 100;

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [saving, setSaving] = useState(false);

  const modalBuiltin =
    modalMode?.kind === 'add-builtin'
      ? BUILTIN_WIDGETS.find((b) => b.type === modalMode.widgetType)
      : null;

  const editWidget = modalMode?.kind === 'edit' ? modalMode.widget : null;

  const handleAddBuiltin = useCallback(
    async (url: string) => {
      if (modalMode?.kind !== 'add-builtin') return;
      setSaving(true);
      try {
        await addWidget(modalMode.widgetType, { url });
        toast.success(t('room.settings.widgets.widgetAdded'));
        setModalMode(null);
      } catch (err) {
        toast.error(t('room.settings.widgets.widgetAddFailed', { error: getErrorMessage(err) }));
      } finally {
        setSaving(false);
      }
    },
    [modalMode, addWidget, toast, t]
  );

  const handleEditorSave = useCallback(
    async (stateKey: string, content: Record<string, unknown>) => {
      setSaving(true);
      try {
        await client.sendStateEvent(
          roomId,
          'm.room.widget' as UntypedStateEventType,
          content as RawStateContent,
          stateKey
        );
        toast.success(
          modalMode?.kind === 'edit'
            ? t('room.settings.widgets.widgetUpdated')
            : t('room.settings.widgets.widgetAdded')
        );
        setModalMode(null);
      } catch (err) {
        toast.error(t('room.settings.widgets.widgetSaveFailed', { error: getErrorMessage(err) }));
      } finally {
        setSaving(false);
      }
    },
    [client, roomId, modalMode, toast, t]
  );

  const handleDelete = useCallback(
    (widget: RoomWidget) => {
      const displayName = widget.name || widget.type;
      setConfirm({
        open: true,
        title: t('room.settings.widgets.removeWidgetTitle'),
        message: t('room.settings.widgets.removeWidgetConfirm', { name: displayName }),
        danger: true,
        resolve: async (confirmed) => {
          if (!confirmed) return;
          try {
            await removeWidget(widget.stateKey);
            toast.success(t('room.settings.widgets.widgetRemoved', { name: displayName }));
          } catch (err) {
            toast.error(
              t('room.settings.widgets.widgetRemoveFailed', { error: getErrorMessage(err) })
            );
          }
        },
      });
    },
    [removeWidget, setConfirm, toast, t]
  );

  const addedTypes = new Set(widgets.map((w) => w.type));

  return (
    <div>
      <h2 className={panelCss.panelTitle}>{t('room.settings.widgets.title')}</h2>

      {!isAdmin && (
        <div className={panelCss.readOnlyNote}>
          <LockIcon size={14} />
          {t('room.settings.readOnlyPermissions')}
        </div>
      )}

      {isAdmin ? (
        <>
          {/* ── Built-in widgets ── */}
          <div className={css.sectionGap}>
            <p className={css.sectionTitle}>{t('room.settings.widgets.builtinWidgets')}</p>
            <div className={css.cardGrid}>
              {BUILTIN_WIDGETS.map((bw) => {
                const added = addedTypes.has(bw.type);
                return (
                  <div key={bw.type} className={css.card}>
                    <div className={css.cardHeader}>
                      <div className={css.cardIcon}>{bw.icon}</div>
                      <div className={css.cardInfo}>
                        <span className={css.cardName}>{t(bw.nameKey)}</span>
                        <span className={css.cardDesc}>{t(bw.descriptionKey)}</span>
                      </div>
                    </div>
                    {added ? (
                      <span className={css.cardAdded}>
                        <CheckCircleIcon size={14} /> {t('room.settings.widgets.added')}
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setModalMode({ kind: 'add-builtin', widgetType: bw.type })}
                      >
                        <PlusIcon size={14} className={panelCss.iconBefore} />
                        {t('room.settings.widgets.add')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={css.divider} />

          {/* ── Added widgets ── */}
          <div className={css.sectionGap}>
            <p className={css.sectionTitle}>{t('room.settings.widgets.addedWidgets')}</p>
            {widgets.length === 0 ? (
              <div className={css.emptyState}>{t('room.settings.widgets.noWidgets')}</div>
            ) : (
              <div className={css.widgetList}>
                {widgets.map((w) => (
                  <AddedRow
                    key={w.stateKey}
                    widget={w}
                    onEdit={(widget) => setModalMode({ kind: 'edit', widget })}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          <div className={css.divider} />

          {/* ── Custom widgets ── */}
          <div className={css.sectionGap}>
            <p className={css.sectionTitle}>{t('room.settings.widgets.customWidgets')}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setModalMode({ kind: 'add-custom' })}
            >
              <PlusIcon size={14} className={panelCss.iconBefore} />
              {t('room.settings.widgets.addCustomWidget')}
            </Button>
          </div>

          {/* ── Add built-in modal ── */}
          <AddBuiltinModal
            open={modalMode?.kind === 'add-builtin'}
            title={t('room.settings.widgets.addWidgetBtn', {
              name: modalBuiltin?.nameKey ? t(modalBuiltin.nameKey) : 'Widget',
            })}
            defaultUrl={modalBuiltin?.defaultUrl}
            urlPlaceholder={modalBuiltin?.urlPlaceholder}
            urlHelp={modalBuiltin?.urlHelpKey ? t(modalBuiltin.urlHelpKey) : undefined}
            saving={saving}
            onClose={() => setModalMode(null)}
            onSave={handleAddBuiltin}
          />

          {/* ── Shared editor modal: add-custom + edit ── */}
          <WidgetEditorModal
            open={modalMode?.kind === 'add-custom' || modalMode?.kind === 'edit'}
            widget={editWidget}
            client={client}
            saving={saving}
            onClose={() => setModalMode(null)}
            onSave={handleEditorSave}
          />
        </>
      ) : (
        <>
          {/* ── Added widgets (read-only) ── */}
          <div className={css.sectionGap}>
            <p className={css.sectionTitle}>{t('room.settings.widgets.addedWidgets')}</p>
            {widgets.length === 0 ? (
              <div className={css.emptyState}>{t('room.settings.widgets.noWidgets')}</div>
            ) : (
              <div className={css.widgetList}>
                {widgets.map((w) => (
                  <AddedRow key={w.stateKey} widget={w} readOnly />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
