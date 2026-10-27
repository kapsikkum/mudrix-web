import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MatrixEvent, MatrixEventEvent } from 'matrix-js-sdk';

interface DecryptionGateProps {
  event: MatrixEvent;
  children: () => ReactNode;
  /**
   * Rendered while the event is still being decrypted. Without one the row has
   * no height and pops open (shifting everything below) once decryption ends.
   */
  fallback?: ReactNode;
}

export function DecryptionGate({ event, children, fallback = null }: DecryptionGateProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleDecrypted = () => setTick((tick) => tick + 1);
    setTick((tick) => tick + 1);
    event.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      event.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [event]);

  // A retry of a message that already failed keeps its placeholder instead of flashing a skeleton.
  if (event.isBeingDecrypted() && !event.isDecryptionFailure()) return <>{fallback}</>;
  return <>{children()}</>;
}
