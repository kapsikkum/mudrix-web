import { useRef, useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { editMessageAtom } from '@/app/store/atoms';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { getMatrixClient } from '@/client/initMatrix';
import { markdownToHtml } from '@/util/markdownToHtml';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Textarea } from '@/app/components/Input';
import * as css from './EditMessageModal.css';

export function EditMessageModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(editMessageAtom);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const editEventId = state?.eventId;

  // Sync value when a new edit is opened
  useEffect(() => {
    if (state) {
      setValue(state.body);
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 30);
    }
  }, [editEventId, state]);

  const close = useCallback(() => {
    setState(null);
    setValue('');
    setSaving(false);
  }, [setState]);

  const save = useCallback(async () => {
    if (!state) return;
    const newBody = value.trim();
    if (!newBody || newBody === state.body) {
      close();
      return;
    }

    setSaving(true);
    try {
      const client = getMatrixClient();

      const formattedBody = markdownToHtml(newBody);
      await client.sendMessage(state.roomId, {
        msgtype: 'm.text',
        body: `* ${newBody}`,
        format: 'org.matrix.custom.html',
        formatted_body: formattedBody,
        'm.new_content': {
          msgtype: 'm.text',
          body: newBody,
          format: 'org.matrix.custom.html',
          formatted_body: formattedBody,
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: state.eventId,
        },
      } as RoomMessageEventContent);
      close();
    } catch (err) {
      toast.error(t('timeline.editFailed', { error: getErrorMessage(err) }));
      setSaving(false);
    }
  }, [state, value, close, toast, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      }
    },
    [close, save]
  );

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  };

  return (
    <Modal
      open={!!state}
      onClose={close}
      title={t('timeline.editTitle')}
      size="lg"
      zIndex={8000}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={saving || !value.trim()}
            loading={saving}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('timeline.editPlaceholder')}
        disabled={saving}
      />
      <span className={css.hint}>{t('timeline.editHint')}</span>
    </Modal>
  );
}
