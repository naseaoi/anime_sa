import React, { useEffect, useRef, useState } from 'react';
import { PublicShelf, type PublicShelfProps, type ShelfVariant } from './PublicShelf';

const PLACEHOLDER_CLASS: Record<ShelfVariant, string> = {
  poster: 'min-h-[190px] sm:min-h-[215px]',
  wide: 'min-h-[150px] lg:min-h-[170px]'
};

interface DeferredPublicShelfProps extends PublicShelfProps {
  defer?: boolean;
}

export const DeferredPublicShelf: React.FC<DeferredPublicShelfProps> = ({
  defer = false,
  variant = 'poster',
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(() => (
    !defer || typeof IntersectionObserver === 'undefined'
  ));

  useEffect(() => {
    if (mounted || !defer) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setMounted(true);
      observer.disconnect();
    }, { rootMargin: '32px 0px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, [defer, mounted]);

  return (
    <div ref={containerRef} className={PLACEHOLDER_CLASS[variant]}>
      {mounted && <PublicShelf {...props} variant={variant} />}
    </div>
  );
};
