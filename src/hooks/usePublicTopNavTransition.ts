import { useLayoutEffect, useRef } from 'react';

const TRANSITION_OPTIONS: KeyframeAnimationOptions = {
  duration: 460,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
};

export const usePublicTopNavTransition = (narrow: boolean) => {
  const leadingRef = useRef<HTMLDivElement>(null);
  const trailingRef = useRef<HTMLDivElement>(null);
  const previousNarrowRef = useRef(narrow);

  useLayoutEffect(() => {
    const previousNarrow = previousNarrowRef.current;
    previousNarrowRef.current = narrow;

    const leading = leadingRef.current;
    const trailing = trailingRef.current;
    if (
      previousNarrow === narrow
      || !leading
      || !trailing
      || typeof leading.animate !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;

    const leadingOffset = narrow
      ? 'translate3d(calc(var(--page-x) - var(--detail-x)), 0, 0)'
      : 'translate3d(calc(var(--detail-x) - var(--page-x)), 0, 0)';
    const trailingOffset = narrow
      ? 'translate3d(calc(var(--detail-x) - var(--page-x)), 0, 0)'
      : 'translate3d(calc(var(--page-x) - var(--detail-x)), 0, 0)';

    const animations = [
      leading.animate([
        { transform: leadingOffset, opacity: 0.55 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
      ], TRANSITION_OPTIONS),
      trailing.animate([
        { transform: trailingOffset },
        { transform: 'translate3d(0, 0, 0)' }
      ], TRANSITION_OPTIONS)
    ];

    return () => animations.forEach((animation) => animation.cancel());
  }, [narrow]);

  return { leadingRef, trailingRef };
};
