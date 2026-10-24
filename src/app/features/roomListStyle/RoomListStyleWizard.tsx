import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useSetAtom } from 'jotai';
import { Dialog } from '@/app/components/Dialog/Dialog';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useSyncReady } from '@/app/hooks/useSync';
import {
  roomListStyleAtom,
  roomListStyleChosenAtom,
  type RoomListStyle,
} from '@/app/store/atoms/settings';
import * as css from './RoomListStyleWizard.css';

// Settings sync pulls the account's saved choice shortly after the first sync; wait for it so
// someone who already picked is not asked again.
const SETTLE_MS = 2500;

function Preview({ style: roomListStyle }: { style: RoomListStyle }) {
  const rows = [
    { icon: '#', name: 'general' },
    { icon: '#', name: 'art-dump' },
    { icon: '🔊', name: 'Hangout' },
  ];
  return (
    <div className={css.preview} aria-hidden>
      {rows.map((row) => (
        <div key={row.name} className={css.previewRow}>
          {roomListStyle === 'matrix' ? (
            <span className={css.previewAvatar} />
          ) : (
            <span className={css.previewIcon}>{row.icon}</span>
          )}
          <span>{row.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Asks once, on first use, which room list the person prefers. */
export function RoomListStyleWizard() {
  const { t } = useTranslation();
  const syncReady = useSyncReady();
  const [chosen, setChosen] = useAtom(roomListStyleChosenAtom);
  const setStyle = useSetAtom(roomListStyleAtom);
  const [settled, setSettled] = useState(false);
  const signedIn = !!getMatrixClientOrNull();

  useEffect(() => {
    if (!syncReady) return undefined;
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [syncReady]);

  const pick = (next: RoomListStyle) => {
    setStyle(next);
    setChosen(true);
  };

  const options: { value: RoomListStyle; title: string; note: string }[] = [
    {
      value: 'matrix',
      title: t('settings.appearance.roomListStyleMatrix'),
      note: t('roomListWizard.matrixNote'),
    },
    {
      value: 'modern',
      title: t('settings.appearance.roomListStyleModern'),
      note: t('roomListWizard.modernNote'),
    },
  ];

  return (
    <Dialog
      open={signedIn && settled && !chosen}
      onClose={() => setChosen(true)}
      title={t('roomListWizard.title')}
      size="md"
      zIndex={7500}
      footer={<p className={css.footerNote}>{t('roomListWizard.later')}</p>}
    >
      <p className={css.intro}>{t('roomListWizard.intro')}</p>
      <div className={css.options}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={css.option}
            onClick={() => pick(option.value)}
          >
            <Preview style={option.value} />
            <span className={css.optionTitle}>{option.title}</span>
            <span className={css.optionNote}>{option.note}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
