import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { AppWindowIcon, MonitorIcon } from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal/Modal';
import { Button } from '@/app/components/Button/Button';
import { Select } from '@/app/components/Select';
import { Toggle } from '@/app/components/Toggle';
import {
  screenShareAudioAtom,
  screenShareCursorAtom,
  screenShareFpsAtom,
  screenShareQualityAtom,
  type ScreenShareFps,
  type ScreenShareQuality,
} from '@/app/store/atoms/settings';
import {
  getScreenSharePickRequest,
  resolveScreenSharePick,
  subscribeScreenSharePick,
  type ScreenSharePickRequest,
} from '@/app/plugins/call/nativeCapture/screenSharePickerBus';
import { captureListSources, type CaptureSource } from '@/util/desktop';
import * as css from './ScreenSharePicker.css';

const THUMB_WIDTH = 320;
const REFRESH_MS = 2000;
const QUALITY_OPTIONS: ScreenShareQuality[] = ['720', '1080', 'source'];
const FPS_OPTIONS: ScreenShareFps[] = [15, 30, 60];

type SourceKind = CaptureSource['kind'];

/** Discord-style "choose what to share" dialog for the native screen capture. */
export function ScreenSharePicker() {
  const request = useSyncExternalStore(subscribeScreenSharePick, getScreenSharePickRequest);
  if (!request) return null;
  return <PickerDialog request={request} />;
}

function PickerDialog({ request }: { request: ScreenSharePickRequest }) {
  const { t } = useTranslation();
  const idBase = useId();
  const [quality, setQuality] = useAtom(screenShareQualityAtom);
  const [fps, setFps] = useAtom(screenShareFpsAtom);
  const [audio, setAudio] = useAtom(screenShareAudioAtom);
  const [cursor, setCursor] = useAtom(screenShareCursorAtom);

  const [sources, setSources] = useState<CaptureSource[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<SourceKind>('screen');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      captureListSources(THUMB_WIDTH)
        .then((list) => {
          if (disposed) return;
          setSources(list);
          setFailed(false);
          setSelectedId(
            (current) =>
              current ??
              (
                list.find((s) => s.kind === 'screen' && s.primary) ??
                list.find((s) => s.kind === 'screen') ??
                list[0]
              )?.id ??
              null
          );
        })
        .catch((err) => {
          console.warn('[capture] capture_list_sources failed', err);
          if (!disposed) setFailed(true);
        })
        .finally(() => {
          inFlight = false;
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const visible = (sources ?? []).filter((s) => s.kind === tab);
  const selected = (sources ?? []).find((s) => s.id === selectedId) ?? null;

  const cancel = useCallback(() => resolveScreenSharePick(null), []);

  const share = useCallback(
    (source: CaptureSource | null) => {
      if (!source) return;
      resolveScreenSharePick({
        source,
        maxHeight: quality === 'source' ? 0 : Number(quality) || 1080,
        fps,
        audio: request.allowAudio && audio,
        cursor,
      });
    },
    [quality, fps, audio, cursor, request.allowAudio]
  );

  const selectTab = (next: SourceKind) => {
    setTab(next);
    // Keep the selection inside the visible tab so Share never acts on a hidden card.
    const first = (sources ?? []).find((s) => s.kind === next);
    if (selected?.kind !== next) setSelectedId(first?.id ?? null);
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = tab === 'screen' ? 'window' : 'screen';
    selectTab(next);
    (
      e.currentTarget.parentElement?.querySelector(`[data-tab="${next}"]`) as HTMLElement | null
    )?.focus();
  };

  const onCardKeyDown = (e: React.KeyboardEvent, index: number) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key) || visible.length === 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = (index + step + visible.length) % visible.length;
    setSelectedId(visible[nextIndex].id);
    (listRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex] ?? null)?.focus();
  };

  const tabLabel = (kind: SourceKind) =>
    kind === 'screen' ? t('voice.screenPicker.screens') : t('voice.screenPicker.applications');

  const qualityOptions = QUALITY_OPTIONS.map((value) => ({
    value,
    label: value === 'source' ? t('voice.screenPicker.qualitySource') : `${value}p`,
  }));
  const fpsOptions = FPS_OPTIONS.map((value) => ({
    value: String(value),
    label: `${value} fps`,
  }));

  const panelId = `${idBase}-panel`;
  const hasSelectionInTab = selected?.kind === tab;
  const focusableId = hasSelectionInTab ? selected.id : visible[0]?.id;

  return (
    <Modal
      open
      onClose={cancel}
      title={t('voice.screenPicker.title')}
      size="xl"
      zIndex={8000}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={cancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="md" disabled={!selected} onClick={() => share(selected)}>
            {t('voice.screenPicker.share')}
          </Button>
        </>
      }
    >
      <div className={css.tabs} role="tablist" aria-label={t('voice.screenPicker.sources')}>
        {(['screen', 'window'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="tab"
            data-tab={kind}
            aria-selected={tab === kind}
            aria-controls={panelId}
            tabIndex={tab === kind ? 0 : -1}
            className={[css.tab, tab === kind ? css.tabActive : ''].filter(Boolean).join(' ')}
            onClick={() => selectTab(kind)}
            onKeyDown={onTabKeyDown}
          >
            {tabLabel(kind)}
          </button>
        ))}
      </div>

      <div id={panelId} role="tabpanel" className={css.listArea} ref={listRef}>
        {sources === null ? (
          <div className={css.status}>
            {failed ? t('voice.screenPicker.loadFailed') : t('common.loading')}
          </div>
        ) : visible.length === 0 ? (
          <div className={css.status}>
            {tab === 'screen'
              ? t('voice.screenPicker.noScreens')
              : t('voice.screenPicker.noWindows')}
          </div>
        ) : (
          <div className={css.grid} role="radiogroup" aria-label={tabLabel(tab)}>
            {visible.map((source, index) => {
              const isSelected = source.id === selectedId;
              return (
                <button
                  key={source.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={source.id === focusableId ? 0 : -1}
                  title={source.appName ? `${source.appName}: ${source.name}` : source.name}
                  className={[css.card, isSelected ? css.cardSelected : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedId(source.id)}
                  onDoubleClick={() => share(source)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isSelected) {
                      e.preventDefault();
                      share(source);
                      return;
                    }
                    onCardKeyDown(e, index);
                  }}
                >
                  <span className={css.thumb}>
                    {source.thumb ? (
                      <img className={css.thumbImage} src={source.thumb} alt="" draggable={false} />
                    ) : source.kind === 'screen' ? (
                      <MonitorIcon size={32} />
                    ) : (
                      <AppWindowIcon size={32} />
                    )}
                  </span>
                  <span className={css.caption}>
                    {source.icon ? (
                      <img className={css.captionIcon} src={source.icon} alt="" draggable={false} />
                    ) : (
                      <span className={css.captionIcon}>
                        {source.kind === 'screen' ? (
                          <MonitorIcon size={16} />
                        ) : (
                          <AppWindowIcon size={16} />
                        )}
                      </span>
                    )}
                    <span className={css.captionText}>{source.name}</span>
                    {source.primary && (
                      <span className={css.badge}>{t('voice.screenPicker.primary')}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={css.options}>
        <div className={css.optionSelect}>
          <span className={css.optionLabel} aria-hidden="true">
            {t('voice.screenPicker.quality')}
          </span>
          <Select
            value={quality}
            onChange={setQuality}
            options={qualityOptions}
            aria-label={t('voice.screenPicker.quality')}
          />
        </div>
        <div className={css.optionSelect}>
          <span className={css.optionLabel} aria-hidden="true">
            {t('voice.screenPicker.frameRate')}
          </span>
          <Select
            value={String(fps)}
            onChange={(value) => setFps(Number(value) as ScreenShareFps)}
            options={fpsOptions}
            aria-label={t('voice.screenPicker.frameRate')}
          />
        </div>
        {request.allowAudio && (
          <div className={css.optionToggle}>
            <Toggle id={`${idBase}-audio`} size="sm" checked={audio} onChange={setAudio} />
            <label className={css.optionToggleLabel} htmlFor={`${idBase}-audio`}>
              {t('voice.screenPicker.shareAudio')}
            </label>
          </div>
        )}
        <div className={css.optionToggle}>
          <Toggle id={`${idBase}-cursor`} size="sm" checked={cursor} onChange={setCursor} />
          <label className={css.optionToggleLabel} htmlFor={`${idBase}-cursor`}>
            {t('voice.screenPicker.showCursor')}
          </label>
        </div>
      </div>
    </Modal>
  );
}
