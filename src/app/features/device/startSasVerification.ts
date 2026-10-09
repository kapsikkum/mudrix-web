import { VerificationPhase, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api';
import type {
  VerificationRequest,
  ShowSasCallbacks,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import type { SetStateAction } from 'jotai';
import type { EmojiVerificationState } from '@/app/store/atoms';

type EmojiVerificationSetter = (update: SetStateAction<EmojiVerificationState>) => void;

export function startSasVerification(
  request: VerificationRequest,
  setEmojiModal: EmojiVerificationSetter
): () => void {
  let started = false;
  let wired = false;
  let disposed = false;

  const cancel = () =>
    setEmojiModal((prev) => (prev.phase !== 'done' ? { ...prev, phase: 'cancelled' } : prev));

  const onRequestChange = async () => {
    if (disposed) return;
    const phase = request.phase;

    if (!started && (phase === VerificationPhase.Ready || phase === VerificationPhase.Requested)) {
      started = true;
      try {
        await request.startVerification('m.sas.v1');
      } catch {
        cancel();
      }
      return;
    }

    if (phase === VerificationPhase.Started && request.verifier && !wired) {
      const verifier = request.verifier;
      wired = true;

      verifier.on(VerifierEvent.ShowSas, (sasCallbacks: ShowSasCallbacks) => {
        setEmojiModal((prev) => ({
          ...prev,
          phase: 'comparing',
          emojis: sasCallbacks.sas.emoji ?? [],
          sasCallbacks,
        }));
      });

      verifier.on(VerifierEvent.Cancel, () => {
        cancel();
      });

      verifier.verify().catch(() => {
        cancel();
      });
      return;
    }

    if (phase === VerificationPhase.Done) {
      setEmojiModal((prev) => ({ ...prev, phase: 'done' }));
      return;
    }

    if (phase === VerificationPhase.Cancelled) {
      cancel();
    }
  };

  setEmojiModal({
    open: true,
    request,
    phase: 'waiting',
    otherUserId: request.otherUserId,
  });

  request.on('change' as Parameters<typeof request.on>[0], onRequestChange);

  return () => {
    disposed = true;
    request.off('change' as Parameters<typeof request.off>[0], onRequestChange);
  };
}
