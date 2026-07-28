
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, Suspense } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from '../router';
import { ThumbsUp, PlayCircle, Grid, ArrowUp } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { usePublicNavigation } from './public/PublicNavigationContext';
import { PublicCardGrid } from './public/PublicCardGrid';
import type { SortKey, SortOrder } from './public/PublicTopNav';
import { getHomeScrollKey, readScrollPosition, readVisibleCount, writeScrollPosition, writeVisibleCount } from '../utils/browserState';
import { PUBLIC_DATA_LIMITS } from '../../shared/publicDataSchema.js';
import { PublicStructuredHome } from './public/PublicStructuredHome';
import { CardGridSkeleton } from './public/PublicSkeletons';
import { useBackToTop } from '../hooks/useBackToTop';
import { useCardCreate, QUICK_CREATE_INITIAL_CARD } from '../hooks/useCardCreate';
import { useHeroRotation } from '../hooks/useHeroRotation';
import { useStructuredHomeSections } from '../hooks/useStructuredHomeSections';
import { getCardCoverUrl } from '../utils/cardCover';
import { getCoverAmbientColor } from '../utils/coverAmbientColor';
import { getTagSlug, resolveLegacySection, resolveSectionTag, sectionFromCard } from '../utils/routeUtils';
import { getTagIcon } from '../utils/tagIcons';
import { applyPageMetadata } from '../utils/seo';

const CardEditModal = React.lazy(() => import('./CardEditModal').then((m) => ({ default: m.CardEditModal })));

const INITIAL_LOAD_COUNT = 32;
const LOAD_MORE_COUNT = 20;
const GRID_TRANSITION_MS = 420;
const SHELF_CARD_LIMIT = 12;
const HERO_CARD_LIMIT = 14;

type GridSortConfig = { key: SortKey; order: SortOrder };

const getGridKey = (tagId: string, term: string, sort: GridSortConfig) =>
  `${tagId}-${term}-${sort.key}-${sort.order}`;

interface PublicHomeProps {
  data: PublicData;
  refreshData: () => Promise<void>;
}

export const PublicHome: React.FC<PublicHomeProps> = ({ data, refreshData }) => {
  const { section } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { searchTerm, sortConfig, onTagChange, createRequestToken } = usePublicNavigation();

  const [visibleCount, setVisibleCount] = useState(() => {
    return readVisibleCount(INITIAL_LOAD_COUNT, PUBLIC_DATA_LIMITS.maxCards);
  });

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isGridTransitioning, setIsGridTransitioning] = useState(false);
  const [heroAmbient, setHeroAmbient] = useState<string | null>(null);

  const { isCreateModalOpen, setIsCreateModalOpen, handleCreatePersist } = useCardCreate(data, refreshData);
  const handledCreateRequestRef = useRef(createRequestToken);

  useEffect(() => {
    if (createRequestToken === handledCreateRequestRef.current) return;
    handledCreateRequestRef.current = createRequestToken;
    setIsCreateModalOpen(true);
  }, [createRequestToken, setIsCreateModalOpen]);

  const showBackToTop = useBackToTop();

  // 持久化 visibleCount
  useEffect(() => { writeVisibleCount(visibleCount); }, [visibleCount]);

  // 列表滚动位置
  const scrollStorageKey = getHomeScrollKey(location.pathname, location.search);
  const hasRestoredScrollRef = useRef(false);
  const gridTransitionTimerRef = useRef<number | null>(null);
  const visitedGridKeysRef = useRef<Set<string>>(new Set());

  // 浏览器滚动恢复
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  // 用户滚动位置持久化
  useEffect(() => {
    const save = () => writeScrollPosition(scrollStorageKey, window.scrollY);
    let rafId: number | null = null;
    const onUserScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        save();
        rafId = null;
      });
    };
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      // 仅对会引发导航的元素同步落盘：Link 渲染成 <a>，侧边栏标签按钮等用 <button>
      if (!target.closest('a, button')) return;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      save();
    };
    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchmove', onUserScroll, { passive: true });
    window.addEventListener('keydown', onUserScroll, { passive: true });
    document.addEventListener('click', onClickCapture, true);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchmove', onUserScroll);
      window.removeEventListener('keydown', onUserScroll);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [scrollStorageKey]);

  const resolvedActiveTag = useMemo(() => resolveSectionTag(section, data.tags), [section, data.tags]);
  const activeTag = resolvedActiveTag || 'all';

  useEffect(() => {
    return () => {
      if (gridTransitionTimerRef.current !== null) {
        window.clearTimeout(gridTransitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (data.settings.title) {
      applyPageMetadata(data.settings.title);
    }
    if (data.settings.iconUrl) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
      if (favicon) favicon.href = data.settings.iconUrl;
    }
  }, [data.settings.title, data.settings.iconUrl]);

  // 无效分区 fallback 到首页
  useEffect(() => {
    if (!section || resolvedActiveTag) return;
    navigate('/', { replace: true });
  }, [section, resolvedActiveTag, navigate]);

  // 旧链接 ?tag=xxx 迁移到 path 形式
  useEffect(() => {
    if (section) return;
    const legacyTag = searchParams.get('tag');
    if (!legacyTag) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tag');
    const query = nextParams.toString();
    const suffix = query ? `?${query}` : '';

    const legacySection = resolveLegacySection(legacyTag, data.tags);
    if (legacySection) navigate(`/${legacySection}${suffix}`, { replace: true });
  }, [section, searchParams, data.tags, navigate]);

  const resetListView = () => {
    setVisibleCount(INITIAL_LOAD_COUNT);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setIsLoadingMore(false);
  };

  const startGridTransition = (nextGridKey: string, nextTagId: string, nextSearchTerm = searchTerm) => {
    if (gridTransitionTimerRef.current !== null) {
      window.clearTimeout(gridTransitionTimerRef.current);
    }
    setIsLoadingMore(false);

    if ((nextTagId === 'all' && !nextSearchTerm) || visitedGridKeysRef.current.has(nextGridKey)) {
      setIsGridTransitioning(false);
      gridTransitionTimerRef.current = null;
      return;
    }

    setIsGridTransitioning(true);
    gridTransitionTimerRef.current = window.setTimeout(() => {
      setIsGridTransitioning(false);
      gridTransitionTimerRef.current = null;
    }, GRID_TRANSITION_MS);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hero 轮播卡片
  const heroSeedRef = useRef<number>(Math.floor(Math.random() * 0xffffffff) >>> 0);
  const heroCards = useMemo(() => {
    const recommended = data.cards.filter(c => c.isRecommended);
    const seed = heroSeedRef.current;
    const score = (id: string) => {
      let h = seed ^ 0x811c9dc5;
      for (let i = 0; i < id.length; i += 1) {
        h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
      }
      return h;
    };
    const sorted = [...recommended].sort((a, b) => score(a.id) - score(b.id));
    return sorted.slice(0, HERO_CARD_LIMIT);
  }, [data.cards]);

  const showHero = activeTag === 'all' && !searchTerm && heroCards.length > 0;

  const prefersReducedMotionRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const hero = useHeroRotation(heroCards.length, showHero && !prefersReducedMotionRef.current);
  const currentHeroCard = showHero ? heroCards[hero.heroIndex] : undefined;

  useEffect(() => {
    if (!currentHeroCard) {
      setHeroAmbient(null);
      return;
    }

    let cancelled = false;
    getCoverAmbientColor(currentHeroCard.id, getCardCoverUrl(currentHeroCard, 'thumb')).then((color) => {
      if (!cancelled) setHeroAmbient(color);
    });
    return () => { cancelled = true; };
  }, [currentHeroCard]);

  // --- 事件处理 ---

  const handleTagChange = (tagId: string) => {
    if (tagId !== activeTag) startGridTransition(getGridKey(tagId, searchTerm, sortConfig), tagId);
    onTagChange(tagId);
    resetListView();
  };

  // --- 数据过滤 ---
  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const hasSearch = term.length > 0;
    const list: CardData[] = [];

    for (const card of data.cards) {
      if (hasSearch) {
        const title = card.title.toLowerCase();
        const description = card.description.toLowerCase();
        if (!title.includes(term) && !description.includes(term)) {
          continue;
        }
      }

      if (activeTag === 'recommended' && !card.isRecommended) continue;
      if (activeTag === 'watching' && !card.isWatching) continue;
      if (activeTag !== 'all' && activeTag !== 'recommended' && activeTag !== 'watching' && !card.tagIds.includes(activeTag)) continue;

      list.push(card);
    }

    list.sort((a, b) => {
      const valA = a[sortConfig.key] || 0;
      const valB = b[sortConfig.key] || 0;
      return sortConfig.order === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
    });

    return list;
  }, [data.cards, activeTag, sortConfig, searchTerm]);

  // 首次滚动位置恢复
  useLayoutEffect(() => {
    if (hasRestoredScrollRef.current) return;
    if (filteredCards.length === 0) return;

    const saved = readScrollPosition(scrollStorageKey);
    hasRestoredScrollRef.current = true;
    if (saved === null || saved <= 0) return;

    const y = saved;

    // 滚动恢复重试
    let attempts = 0;
    const tryScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= y || attempts >= 30) {
        window.scrollTo({ top: y, behavior: 'auto' });
        return;
      }
      attempts += 1;
      requestAnimationFrame(tryScroll);
    };
    tryScroll();
  }, [filteredCards.length, scrollStorageKey]);

  const isStructuredHome = activeTag === 'all' && !searchTerm;
  const sectionCardLimit = SHELF_CARD_LIMIT;

  const structuredHomeSections = useStructuredHomeSections({
    isStructuredHome, heroCards, filteredCards, tags: data.tags, sectionCardLimit
  });

  // --- 瀑布流加载 ---
  const loadRef = useRef<HTMLDivElement>(null);
  const hasMore = !isStructuredHome && !isGridTransitioning && visibleCount < filteredCards.length;
  const loadMoreSkeletonCount = isLoadingMore ? Math.min(LOAD_MORE_COUNT, Math.max(filteredCards.length - visibleCount, 0)) : 0;
  const showGridSkeleton = !isStructuredHome && isGridTransitioning && filteredCards.length > 0;
  const gridSkeletonCount = Math.min(visibleCount, filteredCards.length);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredCards.length));
            setIsLoadingMore(false);
          }, 600);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadRef.current) observer.observe(loadRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, filteredCards.length, visibleCount]);

  const gridKey = getGridKey(activeTag, searchTerm, sortConfig);

  useEffect(() => {
    if (isStructuredHome || filteredCards.length === 0) return;
    visitedGridKeysRef.current.add(gridKey);
  }, [filteredCards.length, gridKey, isStructuredHome]);

  const activeSectionSlug = useMemo(() => {
    if (activeTag === 'recommended' || activeTag === 'watching') return activeTag;
    if (activeTag === 'all') return null;
    const tag = data.tags.find((item) => item.id === activeTag);
    return tag ? getTagSlug(tag) : null;
  }, [activeTag, data.tags]);

  const activeTagLabel = useMemo(() => {
    if (activeTag === 'all') return '';
    if (activeTag === 'recommended') return '精选推荐';
    if (activeTag === 'watching') return '正在观看';
    return data.tags.find((tag) => tag.id === activeTag)?.name || '';
  }, [activeTag, data.tags]);

  const activeTagLeadIcon = useMemo(() => {
    if (activeTag === 'recommended') return <ThumbsUp size={28} className="text-amber-500" />;
    if (activeTag === 'watching') return <PlayCircle size={28} className="text-sky-500" />;
    const tag = data.tags.find((item) => item.id === activeTag);
    return getTagIcon(tag?.icon, 'w-7 h-7') || <span className="text-[color:var(--accent)] text-3xl font-bold leading-none">|</span>;
  }, [activeTag, data.tags]);

  const getCardHrefBySection = (card: CardData, forcedSection?: string) => {
    const sectionSlug = forcedSection || sectionFromCard(card, data.tags);
    return `/${sectionSlug}/${card.id}`;
  };

  const getCardLinkState = () => ({ from: `${location.pathname}${location.search}` });

  const homeStyle = {
    ...(heroAmbient ? { '--ambient': heroAmbient } : {})
  } as React.CSSProperties;

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-amber-500/80 selection:text-white dark:selection:bg-amber-200 dark:selection:text-black transition-colors duration-300 hero-ambient"
      style={homeStyle}
    >
      <main className="flex-1 overflow-x-hidden flex flex-col">
        {filteredCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-28 text-[color:color-mix(in_srgb,var(--text-secondary)_60%,transparent)]">
            <Grid size={60} className="mb-4 stroke-[1.2]" />
            <p className="font-display text-2xl mb-2">暂无匹配内容</p>
            <p className="text-sm tracking-[0.18em] uppercase">Try another filter</p>
          </div>
        ) : isStructuredHome && structuredHomeSections ? (
          <PublicStructuredHome
            sections={structuredHomeSections}
            gridKey={gridKey}
            sectionCardLimit={sectionCardLimit}
            showHero={showHero}
            heroCards={heroCards}
            heroIndex={hero.heroIndex}
            setHeroIndex={hero.setHeroIndex}
            setIsHeroPaused={hero.setIsHeroPaused}
            onTouchStart={hero.onTouchStart}
            onTouchMove={hero.onTouchMove}
            onTouchEnd={hero.onTouchEnd}
            getCardHref={(card, forcedSection) => getCardHrefBySection(card, forcedSection)}
            getCardState={getCardLinkState}
            onTagChange={handleTagChange}
            tags={data.tags}
          />
        ) : (
          <div className="px-[var(--page-x)] pt-6 md:pt-8">
            {activeTag !== 'all' && !searchTerm && (
              <div key={activeTag} className="mb-8 fade-up text-center">
                <h3 className="fade-up font-display text-3xl text-[color:var(--text-primary)] inline-flex w-full items-center justify-center gap-2" style={{ animationDelay: '0.06s' }}>
                  <span className="w-7 h-7 inline-flex items-center justify-center text-[color:var(--accent)]">{activeTagLeadIcon}</span>
                  {activeTagLabel}
                </h3>
              </div>
            )}
            <div className="relative">
              {showGridSkeleton && (
                <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
                  <CardGridSkeleton count={gridSkeletonCount} />
                </div>
              )}
              <div className="relative z-10">
                <PublicCardGrid
                  gridKey={gridKey}
                  filteredCards={filteredCards}
                  visibleCount={visibleCount}
                  getCardHref={(card) =>
                    activeSectionSlug ? getCardHrefBySection(card, activeSectionSlug) : getCardHrefBySection(card)
                  }
                  getCardState={getCardLinkState}
                  trailingSkeletonCount={loadMoreSkeletonCount}
                  tags={data.tags}
                />
              </div>
            </div>
          </div>
        )}

        {!isStructuredHome && (hasMore || isLoadingMore) && (
          <div ref={loadRef} className="h-20 w-full" />
        )}

        <footer className="mt-auto px-[var(--page-x)] pt-16 pb-8">
          <div className="h-px bg-gradient-to-r from-transparent via-[color:var(--line)] to-transparent" />
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3.5 text-[11px] text-[color:var(--text-secondary)]">
            <p className="font-semibold tracking-wide">{data.settings.footerLeft || `© ${new Date().getFullYear()}`}</p>
            <span aria-hidden className="hidden sm:block w-1 h-1 rounded-full bg-[color:color-mix(in_srgb,var(--text-secondary)_40%,transparent)]" />
            <p className="tracking-wide opacity-85">{data.settings.footerRight || data.settings.footerText || 'All rights reserved'}</p>
          </div>
        </footer>

        <button
          onClick={scrollToTop}
          className={`fixed bottom-20 right-[var(--page-x)] z-50 w-11 h-11 glass-panel text-[color:var(--text-primary)] rounded-2xl shadow-lg border border-[color:var(--line)] transition-opacity duration-300 flex items-center justify-center ${showBackToTop ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <ArrowUp size={18} />
        </button>
      </main>

      <Suspense fallback={null}>
        {isCreateModalOpen && (
          <CardEditModal
            isOpen
            onClose={() => setIsCreateModalOpen(false)}
            title="快速记录"
            initialCard={QUICK_CREATE_INITIAL_CARD}
            tags={data.tags}
            onPersist={handleCreatePersist}
          />
        )}
      </Suspense>
    </div>
  );
};
