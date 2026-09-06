import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MatrixEvent, MatrixEventEvent } from 'matrix-js-sdk';

interface DecryptionGateProps {
  event: MatrixEvent;
  children: () => ReactNode;
}

export function DecryptionGate({ event, children }: DecryptionGateProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleDecrypted = () => setTick((tick) => tick + 1);
    setTick((tick) => tick + 1);
    event.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      event.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [event]);

  if (event.isBeingDecrypted()) return null;
  return <>{children()}</>;
}
