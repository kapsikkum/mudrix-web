import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import * as css from '@/app/features/calls/ElementCallLayer.css';

interface CallEmbedContainerValue {
  containerRef: RefObject<HTMLDivElement | null>;
  getContainer: () => HTMLDivElement | null;
}

const CallEmbedContainerContext = createContext<CallEmbedContainerValue | null>(null);

export function CallEmbedProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getContainer = useCallback(() => containerRef.current, []);
  const value = useMemo(() => ({ containerRef, getContainer }), [getContainer]);

  return (
    <CallEmbedContainerContext.Provider value={value}>
      <div ref={containerRef} className={css.embedContainer} />
      {children}
    </CallEmbedContainerContext.Provider>
  );
}

export function useElementCallContainer(): CallEmbedContainerValue {
  const ctx = useContext(CallEmbedContainerContext);
  if (!ctx) {
    throw new Error('useElementCallContainer must be used within a CallEmbedProvider');
  }
  return ctx;
}
