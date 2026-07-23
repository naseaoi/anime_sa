import React, { useEffect } from 'react';
import { Star } from 'lucide-react';

// --- 视觉组件：ImagePreview / Rating ---

export const ImagePreview: React.FC<{
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  decoding?: 'async' | 'sync' | 'auto';
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}> = ({ src, srcSet, sizes, alt, className, imageClassName, loading = 'lazy', fetchPriority = 'auto', decoding = 'async', onLoad }) => {
  const [error, setError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  const showImage = !!src && !error;
  const showSkeleton = showImage && !loaded;
  const showFallback = !showImage;

  return (
    <div className={`relative overflow-hidden bg-stone-100 dark:bg-zinc-800 flex items-center justify-center ${className}`}>
      {showImage && (
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          className={`w-full h-full object-cover ${imageClassName || ''}`}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          onLoad={(e) => {
            setLoaded(true);
            onLoad?.(e);
          }}
          onError={() => setError(true)}
        />
      )}
      {showSkeleton && (
        <div className="absolute inset-0 skeleton-shimmer pointer-events-none" />
      )}
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center text-stone-300 dark:text-zinc-600 pointer-events-none">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
      )}
    </div>
  );
};

export const Rating: React.FC<{ value: number }> = ({ value }) => {
  return (
    <div className="flex gap-0.5" title={value.toFixed(1)}>
      {[1, 2, 3, 4, 5].map((star) => {
        // 按 0-100% 比例剪裁星星，实现小数评分渲染
        let percent = 0;
        if (value >= star) {
          percent = 100;
        } else if (value > star - 1) {
          percent = (value - (star - 1)) * 100;
        }

        return (
          <div key={star} className="relative w-[12px] h-[12px]">
             <div className="absolute inset-0 text-stone-200 dark:text-zinc-700">
               <Star size={12} fill="none" stroke="currentColor" />
             </div>
             <div
               className="absolute inset-y-0 left-0 overflow-hidden text-amber-400"
               style={{ width: `${percent}%` }}
             >
               <Star size={12} fill="currentColor" stroke="none" />
             </div>
          </div>
        );
      })}
    </div>
  );
};
