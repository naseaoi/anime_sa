import { useState, useEffect, useRef } from 'react';
import type React from 'react';

// Hero 卡片自动轮播 + 左右滑动切换
// enabled=false 时完全不创建定时器；悬停可通过 setIsHeroPaused(true) 暂停
export const useHeroRotation = (length: number, enabled: boolean, intervalMs = 4000) => {
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current || length === 0) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50) setHeroIndex(prev => (prev + 1) % length);
    if (distance < -50) setHeroIndex(prev => (prev - 1 + length) % length);
  };

  useEffect(() => {
    if (!enabled || isHeroPaused || length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, isHeroPaused, length, intervalMs]);

  return {
    heroIndex,
    setHeroIndex,
    setIsHeroPaused,
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};
