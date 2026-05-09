import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { confirmModalAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal/Modal';
import { Button } from '@/app/components/Button/Button';
import { vars } from '@/theme/vars.css';

export function ConfirmModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(confirmModalAtom);

  const close = (confirmed: boolean) => {
    state.resolve?.(confirmed);
    setState({ open: false, title: '', message: '' });
  };

  return (
    <Modal
      open={state.open}
      onClose={() => close(false)}
      title={state.title}
      size="sm"
      zIndex={8000}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={state.danger ? 'danger' : 'primary'}
            size="md"
            onClick={() => close(true)}
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <p style={{ color: vars.color.textMuted, fontSize: '0.95rem', margin: 0 }}>{state.message}</p>
    </Modal>
  );
}
