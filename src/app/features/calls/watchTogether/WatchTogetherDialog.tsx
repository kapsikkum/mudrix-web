import { useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/app/components/Modal/Modal';
import { Button } from '@/app/components/Button/Button';
import { Input } from '@/app/components/Input/Input';
import {
  parseYouTubeId,
  watchActionsAtom,
  watchDialogOpenAtom,
  watchingVideoIdAtom,
  youtubeConsentAtom,
} from './watchTogether';
import * as css from './WatchTogether.css';

/** Asks for a YouTube link and starts it for everyone in the call. */
export function WatchTogetherDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(watchDialogOpenAtom);
  const actions = useAtomValue(watchActionsAtom);
  const setWatching = useSetAtom(watchingVideoIdAtom);
  const setConsent = useSetAtom(youtubeConsentAtom);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setLink('');
    setError(undefined);
  }, [open]);

  const close = () => setOpen(false);
  const start = () => {
    const videoId = parseYouTubeId(link);
    if (!videoId) {
      setError(t('voice.watchTogether.invalidLink'));
      return;
    }
    setConsent(true);
    setWatching(videoId);
    actions?.start(videoId);
    close();
  };

  return (
    <Modal
      open={open && !!actions}
      onClose={close}
      title={t('voice.watchTogether.title')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="md" onClick={start} disabled={!link.trim()}>
            {t('voice.watchTogether.start')}
          </Button>
        </>
      }
    >
      <div className={css.dialogBody}>
        <Input
          label={t('voice.watchTogether.linkLabel')}
          placeholder="https://www.youtube.com/watch?v=…"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          error={error}
          data-dialog-autofocus
        />
        <p className={css.dialogNote}>{t('voice.watchTogether.privacyNote')}</p>
      </div>
    </Modal>
  );
}
