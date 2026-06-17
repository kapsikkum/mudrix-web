import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { ShieldChevronIcon } from '@phosphor-icons/react';
import { verificationBannerAtom, emojiVerificationAtom } from '@/app/store/atoms';
import { VerificationPhase, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api';
import type {
  VerificationRequest,
  ShowSasCallbacks,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import * as css from './VerificationBanner.css';

async function acceptRequest(
  request: VerificationRequest,
  setEmojiModal: ReturnType<typeof useSetAtom<typeof emojiVerificationAtom>>
) {
  try {
    await request.accept();
  } catch {
    // already accepted / already gone
  }

  const otherUser = request.otherUserId;

  setEmojiModal({
    open: true,
    request,
    phase: 'waiting',
    otherUserId: otherUser,
  });

  const onRequestChange = async () => {
    const phase = request.phase;

    if (phase === VerificationPhase.Ready || phase === VerificationPhase.Requested) {
      if (!request.chosenMethod) {
        try {
          const verifier = await request.startVerification('m.sas.v1');

          verifier.on(VerifierEvent.ShowSas, (sasCallbacks: ShowSasCallbacks) => {
            const emojis = sasCallbacks.sas.emoji ?? [];
            setEmojiModal((prev) => ({
              ...prev,
              phase: 'comparing',
              emojis,
              sasCallbacks,
            }));
          });

          verifier.on(VerifierEvent.Cancel, () => {
            setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
          });

          verifier.verify().catch(() => {
            setEmojiModal((prev) => {
              if (prev.phase !== 'done') return { ...prev, phase: 'cancelled' };
              return prev;
            });
          });
        } catch {
          setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
        }
      }
    }

    if (phase === VerificationPhase.Started && request.verifier) {
      const verifier = request.verifier;
      verifier.on(VerifierEvent.ShowSas, (sasCallbacks: ShowSasCallbacks) => {
        const emojis = sasCallbacks.sas.emoji ?? [];
        setEmojiModal((prev) => ({
          ...prev,
          phase: 'comparing',
          emojis,
          sasCallbacks,
        }));
      });
      verifier.on(VerifierEvent.Cancel, () => {
        setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
      });
      verifier.verify().catch(() => {
        setEmojiModal((prev) => {
          if (prev.phase !== 'done') return { ...prev, phase: 'cancelled' };
          return prev;
        });
      });
    }

    if (phase === VerificationPhase.Done) {
      setEmojiModal((prev) => ({ ...prev, phase: 'done' }));
    }

    if (phase === VerificationPhase.Cancelled) {
      setEmojiModal((prev) => {
        if (prev.phase !== 'done') return { ...prev, phase: 'cancelled' };
        return prev;
      });
    }
  };

  request.on('change' as Parameters<typeof request.on>[0], onRequestChange);
}

export function VerificationBanner() {
  const { t } = useTranslation();
  const [state, setBanner] = useAtom(verificationBannerAtom);
  const setEmojiModal = useSetAtom(emojiVerificationAtom);

  if (!state.visible) return null;

  const dismiss = () => setBanner({ visible: false, text: '' });

  const handleDecline = async () => {
    if (state.request) {
      try {
        await state.request.cancel();
      } catch {
        // ignore
      }
    }
    dismiss();
  };

  const handleAccept = async () => {
    dismiss();
    if (state.request) {
      await acceptRequest(state.request, setEmojiModal);
    }
  };

  return (
    <div className={css.banner}>
      <div className={css.icon}>
        <ShieldChevronIcon size={18} />
      </div>
      <div className={css.body}>
        <strong className={css.title}>{t('banner.incomingVerification')}</strong>
        <span className={css.text}>{state.text}</span>
        <div className={css.actions}>
          <button type="button" className={css.btnDecline} onClick={handleDecline}>
            {t('invite.decline')}
          </button>
          <button type="button" className={css.btnAccept} onClick={handleAccept}>
            {t('invite.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
