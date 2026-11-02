import { VerificationPhase, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api';
import type {
  VerificationRequest,
  ShowSasCallbacks,
  Verifier,
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
  let activeVerifier: Verifier | null = null;

  const cancel = () =>
    setEmojiModal((prev) => (prev.phase !== 'done' ? { ...prev, phase: 'cancelled' } : prev));

  const onShowSas = (sasCallbacks: ShowSasCallbacks) => {
    if (disposed) return;
    setEmojiModal((prev) => ({
      ...prev,
      phase: 'comparing',
      emojis: sasCallbacks.sas.emoji ?? [],
      sasCallbacks,
    }));
  };

  const onCancel = () => {
    if (disposed) return;
    cancel();
  };

  const cleanupVerifier = () => {
    if (activeVerifier) {
      activeVerifier.off(VerifierEvent.ShowSas, onShowSas);
      activeVerifier.off(VerifierEvent.Cancel, onCancel);
      activeVerifier = null;
    }
  };

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
      activeVerifier = verifier;
      wired = true;

      verifier.on(VerifierEvent.ShowSas, onShowSas);
      verifier.on(VerifierEvent.Cancel, onCancel);

      verifier.verify().catch(() => {
        cancel();
      });
      return;
    }

    if (phase === VerificationPhase.Done) {
      cleanupVerifier();
      setEmojiModal((prev) => ({ ...prev, phase: 'done' }));
      return;
    }

    if (phase === VerificationPhase.Cancelled) {
      cleanupVerifier();
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
    cleanupVerifier();
  };
}
