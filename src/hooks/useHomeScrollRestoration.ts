import { useEffect, useRef } from 'react';
import { readScrollPosition } from '../utils/browserState';

export const useHomeScrollRestoration = (scrollStorageKey: string, ready: boolean) => {
  const restoredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || restoredKeyRef.current === scrollStorageKey) return;

    const saved = readScrollPosition(scrollStorageKey);
    if (saved === null || saved <= 0) {
      restoredKeyRef.current = scrollStorageKey;
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: saved, behavior: 'auto' });
      restoredKeyRef.current = scrollStorageKey;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [ready, scrollStorageKey]);
};
