import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { confirmModalAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal/Modal';
import { Button } from '@/app/components/Button/Button';
import * as dialogCss from '@/app/components/Dialog/Dialog.css';

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
          <Button
            variant={state.cancelPrimary ? 'primary' : 'secondary'}
            size="md"
            onClick={() => close(false)}
          >
            {state.cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={state.danger ? 'danger' : state.cancelPrimary ? 'secondary' : 'primary'}
            size="md"
            onClick={() => close(true)}
          >
            {state.confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className={dialogCss.dialogMessage}>{state.message}</p>
    </Modal>
  );
}
