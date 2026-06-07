import React from 'react';

interface SkeletonBlockProps {
  className?: string;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = '' }) => (
  <div className={`skeleton-shimmer ${className}`} />
);

const SidebarSkeleton: React.FC = () => (
  <aside className="hidden lg:flex lg:w-72 lg:h-screen lg:sticky lg:top-0 p-5 lg:px-5 flex-col z-40 border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] backdrop-blur-xl">
    <div className="mb-10 flex items-center gap-3">
      <SkeletonBlock className="w-9 h-9 rounded-lg" />
      <div className="space-y-2">
        <SkeletonBlock className="w-28 h-5 rounded-md" />
        <SkeletonBlock className="w-36 h-3 rounded-md" />
      </div>
    </div>
    <nav className="flex flex-col gap-2 flex-1 pr-1">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`primary-${index}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="w-4 h-4 rounded-md" />
            <SkeletonBlock className="w-20 h-4 rounded-md" />
          </div>
          <SkeletonBlock className="w-7 h-3 rounded-md" />
        </div>
      ))}
      <div className="h-px bg-[color:var(--line)]/70 my-4 mx-4" />
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={`tag-${index}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="w-4 h-4 rounded-md" />
            <SkeletonBlock className="w-16 h-4 rounded-md" />
          </div>
          <SkeletonBlock className="w-6 h-3 rounded-md" />
        </div>
      ))}
    </nav>
    <div className="mt-auto pt-5 flex flex-col gap-2">
      <div className="h-px mb-1.5 bg-gradient-to-r from-transparent via-[color:var(--line)] to-transparent" />
      <SkeletonBlock className="h-10 rounded-xl" />
      <SkeletonBlock className="h-10 rounded-xl" />
    </div>
  </aside>
);

const MobileHeaderSkeleton: React.FC = () => (
  <div className="lg:hidden flex flex-col gap-4 mb-6">
    <div className="flex items-center gap-3">
      <SkeletonBlock className="w-9 h-9 rounded-lg" />
      <div className="space-y-2">
        <SkeletonBlock className="w-28 h-5 rounded-md" />
        <SkeletonBlock className="w-36 h-3 rounded-md" />
      </div>
    </div>
    <div className="flex overflow-hidden gap-2 pb-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <SkeletonBlock key={index} className="w-20 h-9 rounded-xl flex-shrink-0" />
      ))}
    </div>
  </div>
);

const ToolbarSkeleton: React.FC = () => (
  <div className="sticky top-3 z-30 mb-8">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <SkeletonBlock className="w-full sm:w-96 h-12 rounded-2xl" />
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        <SkeletonBlock className="w-48 h-11 rounded-xl" />
        <SkeletonBlock className="lg:hidden w-11 h-11 rounded-xl" />
      </div>
    </div>
  </div>
);

interface CardGridSkeletonProps {
  count?: number;
  showHero?: boolean;
}

export const CardSkeleton: React.FC = () => (
  <div className="relative aspect-video rounded-2xl overflow-hidden border border-[color:var(--line)] bg-black/5 dark:bg-white/5 shadow-sm">
    <SkeletonBlock className="absolute inset-0" />
    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
      <div className="flex gap-1.5">
        <SkeletonBlock className="w-12 h-5 rounded-md bg-white/20 dark:bg-white/10" />
        <SkeletonBlock className="w-14 h-5 rounded-md bg-white/20 dark:bg-white/10" />
      </div>
      <SkeletonBlock className="w-3/4 h-6 rounded-lg bg-white/25 dark:bg-white/10" />
      <SkeletonBlock className="hidden md:block w-2/3 h-4 rounded-md bg-white/20 dark:bg-white/10" />
    </div>
  </div>
);

export const CardGridSkeleton: React.FC<CardGridSkeletonProps> = ({ count = 10, showHero = false }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 auto-rows-min">
    {showHero && (
      <div className="relative sm:col-span-2 sm:row-span-2 aspect-[1.72/1] w-full">
        <SkeletonBlock className="absolute inset-0 rounded-[1.4rem] shadow-[0_28px_60px_rgba(0,0,0,0.12)]" />
        <div className="absolute top-4 right-4 w-14 h-7 rounded-lg bg-white/20 dark:bg-white/10" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 space-y-3">
          <SkeletonBlock className="w-28 h-3 rounded-md bg-white/20 dark:bg-white/10" />
          <SkeletonBlock className="w-3/4 h-9 rounded-lg bg-white/25 dark:bg-white/10" />
          <SkeletonBlock className="w-2/3 h-4 rounded-md bg-white/20 dark:bg-white/10" />
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={`h-1 rounded-full bg-white/45 ${index === 0 ? 'w-8' : 'w-2'}`} />
          ))}
        </div>
      </div>
    )}
    {Array.from({ length: count }).map((_, index) => (
      <CardSkeleton key={index} />
    ))}
  </div>
);

export const PublicHomeSkeleton: React.FC = () => (
  <div className="min-h-screen flex flex-col lg:flex-row transition-colors duration-300" aria-busy="true">
    <SidebarSkeleton />
    <main className="flex-1 px-5 md:px-8 lg:px-10 pt-5 md:pt-8 lg:pt-10 overflow-x-hidden flex flex-col min-h-[100dvh]">
      <MobileHeaderSkeleton />
      <ToolbarSkeleton />
      <div className="space-y-12">
        <section>
          <CardGridSkeleton count={8} showHero />
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="w-6 h-6 rounded-md" />
              <SkeletonBlock className="w-24 h-7 rounded-lg" />
              <SkeletonBlock className="w-7 h-3 rounded-md" />
            </div>
            <SkeletonBlock className="hidden md:block w-20 h-5 rounded-md" />
          </div>
          <CardGridSkeleton count={5} />
        </section>
      </div>
    </main>
  </div>
);

