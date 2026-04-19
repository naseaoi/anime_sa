import { useState, useEffect, useRef } from 'react';

// 滚动超过阈值显示"回到顶部"，静止 idleMs 后自动隐藏
export const useBackToTop = (threshold = 300, idleMs = 2000) => {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollIdleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > threshold;
      if (!shouldShow) {
        setShowBackToTop(false);
        if (scrollIdleTimerRef.current) {
          window.clearTimeout(scrollIdleTimerRef.current);
          scrollIdleTimerRef.current = null;
        }
        return;
      }

      setShowBackToTop(true);
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
      scrollIdleTimerRef.current = window.setTimeout(() => {
        setShowBackToTop(false);
      }, idleMs);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, [threshold, idleMs]);

  return showBackToTop;
};
