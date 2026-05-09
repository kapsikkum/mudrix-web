import { useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent, VerificationPhase, VerifierEvent } from 'matrix-js-sdk/lib/crypto-api';
import type {
  VerificationRequest,
  ShowSasCallbacks,
} from 'matrix-js-sdk/lib/crypto-api/verification';
import { verificationBannerAtom, emojiVerificationAtom } from '@/app/store/atoms';

function useHandleVerificationRequest() {
  const setEmojiModal = useSetAtom(emojiVerificationAtom);

  return useCallback(
    (request: VerificationRequest) => {
      const otherUser = request.otherUserId;

      // Open the modal immediately in "waiting" state
      setEmojiModal({
        open: true,
        request,
        phase: 'waiting',
        otherUserId: otherUser,
      });

      const onRequestChange = async () => {
        const phase = request.phase;

        if (phase === VerificationPhase.Ready || phase === VerificationPhase.Requested) {
          // Start emoji (SAS) verification if the other side hasn't already chosen a method
          if (!request.chosenMethod) {
            try {
              const verifier = await request.startVerification('m.sas.v1');

              // Listen for the emoji display event
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

              // Wait for the full verification to resolve
              verifier.verify().catch(() => {
                setEmojiModal((prev) => {
                  if (prev.phase !== 'done') {
                    return { ...prev, phase: 'cancelled' };
                  }
                  return prev;
                });
              });
            } catch {
              // SAS not supported or failed to start — close the modal gracefully
              setEmojiModal((prev) => ({ ...prev, phase: 'cancelled' }));
            }
          }
        }

        if (phase === VerificationPhase.Done) {
          setEmojiModal((prev) => ({ ...prev, phase: 'done' }));
        }

        if (phase === VerificationPhase.Cancelled) {
          setEmojiModal((prev) => {
            if (prev.phase !== 'done') {
              return { ...prev, phase: 'cancelled' };
            }
            return prev;
          });
        }
      };

      request.on('change' as Parameters<typeof request.on>[0], onRequestChange);
    },
    [setEmojiModal]
  );
}

export function useVerification(client: MatrixClient | null) {
  const setBanner = useSetAtom(verificationBannerAtom);
  const setEmojiModal = useSetAtom(emojiVerificationAtom);
  const handleRequest = useHandleVerificationRequest();

  useEffect(() => {
    if (!client) return;

    const onVerificationRequest = (request: VerificationRequest) => {
      const otherUser = request.otherUserId;
      const isSelf = request.isSelfVerification;

      // Show the banner so the user can accept or decline
      setBanner({
        visible: true,
        text: isSelf
          ? `New sign-in detected — verify the new session for ${otherUser}`
          : `Verification request from ${otherUser}`,
        request,
      });
    };

    client.on(
      CryptoEvent.VerificationRequestReceived as Parameters<typeof client.on>[0],
      onVerificationRequest
    );

    return () => {
      client.off(
        CryptoEvent.VerificationRequestReceived as Parameters<typeof client.on>[0],
        onVerificationRequest
      );
    };
  }, [client, setBanner]);

  const acceptVerificationRequest = useCallback(
    async (request: VerificationRequest) => {
      setBanner({ visible: false, text: '' });
      try {
        await request.accept();
        handleRequest(request);
      } catch {
        setEmojiModal({ open: true, phase: 'cancelled', otherUserId: request.otherUserId });
      }
    },
    [setBanner, handleRequest, setEmojiModal]
  );

  const declineVerificationRequest = useCallback(
    async (request: VerificationRequest) => {
      setBanner({ visible: false, text: '' });
      try {
        await request.cancel();
      } catch {
        // ignore
      }
    },
    [setBanner]
  );

  const requestSelfVerification = useCallback(async () => {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto) return;
    try {
      const request = await crypto.requestOwnUserVerification();
      handleRequest(request);
    } catch {
      // ignore
    }
  }, [client, handleRequest]);

  return { acceptVerificationRequest, declineVerificationRequest, requestSelfVerification };
}
