import { useCallback, useEffect, useState, type RefObject } from 'react';

// 监测容器横向溢出，用于决定是否暴露溢出入口
export const useHorizontalOverflow = (ref: RefObject<HTMLElement | null>, key: unknown) => {
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const node = ref.current;
    setOverflowing(!!node && node.scrollWidth - node.clientWidth > 1);
  }, [ref]);

  useEffect(() => {
    measure();
    const node = ref.current;
    if (!node) return;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    window.addEventListener('resize', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, ref, key]);

  return overflowing;
};
