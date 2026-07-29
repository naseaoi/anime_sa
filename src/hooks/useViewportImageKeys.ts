import { useEffect, useState, type RefObject } from 'react';

export const VIEWPORT_IMAGE_KEY_ATTRIBUTE = 'data-viewport-image-key';

const readImageKey = (element: Element) => element.getAttribute(VIEWPORT_IMAGE_KEY_ATTRIBUTE) || '';

export const useViewportImageKeys = (
  containerRef: RefObject<HTMLElement | null>,
  observationKey: string,
  rootMargin = '400px 320px'
) => {
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const elements = [...container.querySelectorAll(`[${VIEWPORT_IMAGE_KEY_ATTRIBUTE}]`)];
    if (elements.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisibleKeys((current) => {
        const next = new Set(current);
        elements.forEach((element) => {
          const key = readImageKey(element);
          if (key) next.add(key);
        });
        return next;
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const intersectingKeys = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => readImageKey(entry.target))
        .filter(Boolean);
      if (intersectingKeys.length === 0) return;

      setVisibleKeys((current) => {
        const next = new Set(current);
        intersectingKeys.forEach((key) => next.add(key));
        return next;
      });
      entries.forEach((entry) => {
        if (entry.isIntersecting) observer.unobserve(entry.target);
      });
    }, { rootMargin });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [containerRef, observationKey, rootMargin]);

  return visibleKeys;
};
