import React from 'react';

interface SkeletonBlockProps {
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = '' }) => (
  <div className={`skeleton-shimmer ${className}`} />
);

const TopNavSkeleton: React.FC = () => (
  <header className="sticky top-0 z-40 border-b border-[color:color-mix(in_srgb,var(--line)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_36%,transparent)] shadow-[0_10px_36px_rgba(0,0,0,0.10)] backdrop-blur-2xl">
    <div className="px-[var(--page-x)]">
      <div className="h-14 lg:h-16 flex items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <SkeletonBlock className="w-8 h-8 rounded-lg" />
          <div className="hidden sm:block space-y-1.5">
            <SkeletonBlock className="w-24 h-4 rounded-md" />
            <SkeletonBlock className="w-20 h-2 rounded-md" />
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-5 flex-1 min-w-0 overflow-hidden">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonBlock key={index} className="w-14 h-4 rounded-md shrink-0" />
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <SkeletonBlock className="hidden md:block w-44 h-9 rounded-xl" />
          <SkeletonBlock className="md:hidden w-9 h-9 rounded-xl" />
          <SkeletonBlock className="w-9 h-9 rounded-xl" />
          <SkeletonBlock className="w-9 h-9 rounded-xl" />
          <SkeletonBlock className="w-9 h-9 rounded-xl" />
        </div>
      </div>
      <div className="lg:hidden flex items-center gap-1.5 overflow-hidden pb-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={index} className="w-16 h-8 rounded-full shrink-0" />
        ))}
      </div>
    </div>
  </header>
);

export const HeroSkeleton: React.FC = () => (
  <div className="relative w-full h-[52vh] min-h-[380px] sm:min-h-[440px] max-h-[680px] overflow-hidden bg-[color:var(--bg-soft)]">
    <SkeletonBlock className="absolute inset-0 lg:left-auto lg:aspect-video" />
    <div className="absolute inset-x-0 bottom-0 px-[var(--page-x)] pb-10 sm:pb-12 lg:inset-y-0 lg:right-auto lg:max-w-[46%] lg:pb-0 lg:flex lg:flex-col lg:justify-center space-y-3">
      <SkeletonBlock className="w-32 h-3 rounded-md" />
      <SkeletonBlock className="w-2/3 max-w-xl h-10 sm:h-14 rounded-lg" />
      <SkeletonBlock className="w-16 h-6 rounded-lg" />
      <SkeletonBlock className="w-1/2 max-w-md h-4 rounded-md" />
    </div>
    <div className="hidden lg:flex absolute bottom-9 left-[var(--page-x)] gap-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <SkeletonBlock key={index} className="w-36 xl:w-40 aspect-video rounded-lg" />
      ))}
    </div>
    <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className={`h-1 rounded-full bg-[color:color-mix(in_srgb,var(--text-primary)_30%,transparent)] ${index === 0 ? 'w-8' : 'w-2'}`} />
      ))}
    </div>
  </div>
);

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative aspect-video rounded-xl overflow-hidden border border-[color:var(--line)] bg-[color:var(--surface)] shadow-sm ${className}`}>
    <SkeletonBlock className="absolute inset-0" />
    <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
      <div className="flex gap-1.5">
        <SkeletonBlock className="w-10 h-4 rounded-md bg-white/20 dark:bg-white/10" />
        <SkeletonBlock className="w-12 h-4 rounded-md bg-white/20 dark:bg-white/10" />
      </div>
      <SkeletonBlock className="w-3/4 h-6 rounded-lg bg-white/25 dark:bg-white/10" />
    </div>
  </div>
);

export const ShelfSkeleton: React.FC = () => (
  <section className="space-y-3.5">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="w-6 h-6 rounded-md" />
        <SkeletonBlock className="w-24 h-7 rounded-lg" />
        <SkeletonBlock className="w-7 h-3 rounded-md" />
      </div>
      <SkeletonBlock className="hidden md:block w-20 h-5 rounded-md" />
    </div>
    <div className="flex gap-4 overflow-hidden pb-1.5">
      {Array.from({ length: 6 }).map((_, index) => (
        <CardSkeleton key={index} className="w-[68vw] sm:w-[280px] lg:w-[300px] shrink-0" />
      ))}
    </div>
  </section>
);

interface CardGridSkeletonProps {
  count?: number;
}

export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({ count = 10 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-min">
    {Array.from({ length: count }).map((_, index) => (
      <CardSkeleton key={index} />
    ))}
  </div>
);

export const PublicHomeSkeleton: React.FC = () => (
  <div className="min-h-screen flex flex-col transition-colors duration-300" aria-busy="true">
    <TopNavSkeleton />
    <main className="flex-1 overflow-x-hidden">
      <HeroSkeleton />
      <div className="px-[var(--page-x)] space-y-10 mt-2">
        <ShelfSkeleton />
        <ShelfSkeleton />
      </div>
    </main>
  </div>
);
