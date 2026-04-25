
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, Suspense } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ThumbsUp, PlayCircle, Grid, Loader2, ArrowUp } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { useToast, useTheme } from './Common';
import { getStorage } from '../services/storageFactory';
import { persistCardCover } from '../services/coverAssetService';
import { PublicCardGrid } from './public/PublicCardGrid';
import { PublicSidebar } from './public/PublicSidebar';
import { PublicMobileTagBar } from './public/PublicMobileTagBar';
import { PublicToolbar, type SortKey, type SortOrder } from './public/PublicToolbar';
import { PublicStructuredHome } from './public/PublicStructuredHome';
import { useGridColumns } from '../hooks/useGridColumns';
import { useBackToTop } from '../hooks/useBackToTop';
import { useHeroRotation } from '../hooks/useHeroRotation';
import { useStructuredHomeSections } from '../hooks/useStructuredHomeSections';
import { buildCardStats } from '../utils/cardStats';
import { getTagSlug, sectionFromCard } from '../utils/routeUtils';
import { getTagIcon } from '../utils/tagIcons';

const CardEditModal = React.lazy(() => import('./CardEditModal').then((m) => ({ default: m.CardEditModal })));

const INITIAL_LOAD_COUNT = 32;
const LOAD_MORE_COUNT = 20;

interface PublicHomeProps {
  data: PublicData;
  refreshData: () => Promise<void>;
  isAdmin: boolean;
}

export const PublicHome: React.FC<PublicHomeProps> = ({ data, refreshData, isAdmin }) => {
  const { section } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  // 状态初始化：优先从 SessionStorage 读取，返回时保持一致
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, order: SortOrder }>(() => {
    try {
      const saved = sessionStorage.getItem('tat_sort_config');
      return saved ? JSON.parse(saved) : { key: 'createdAt', order: 'desc' };
    } catch {
      return { key: 'createdAt', order: 'desc' };
    }
  });

  const [visibleCount, setVisibleCount] = useState(() => {
    try {
      const saved = sessionStorage.getItem('tat_visible_count');
      return saved ? parseInt(saved) : INITIAL_LOAD_COUNT;
    } catch {
      return INITIAL_LOAD_COUNT;
    }
  });

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [staggerCards, setStaggerCards] = useState(() => window.scrollY < 120);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tat_public_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  const gridColumns = useGridColumns();
  const showBackToTop = useBackToTop();

  // 持久化 visibleCount / sortConfig / sidebarCollapsed
  useEffect(() => { sessionStorage.setItem('tat_visible_count', visibleCount.toString()); }, [visibleCount]);
  useEffect(() => { sessionStorage.setItem('tat_sort_config', JSON.stringify(sortConfig)); }, [sortConfig]);
  useEffect(() => { localStorage.setItem('tat_public_sidebar_collapsed', sidebarCollapsed ? '1' : '0'); }, [sidebarCollapsed]);

  // 瀑布流滚动位置记忆：按当前路径+查询作 key 区分，避免不同列表互相串扰
  const scrollStorageKey = `tat_home_scroll:${location.pathname}${location.search}`;
  const hasRestoredScrollRef = useRef(false);

  // 接管历史滚动恢复，确保由我们在 DOM 渲染后精确还原
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = prev; };
  }, []);

  // 瀑布流滚动位置记忆：
  // 关键问题：React 18 下，新页面 mount 的 scrollTo(0,0) 可能先于本组件 cleanup 运行，
  // 仅监听 'scroll' 事件会把这个 0 也写入 storage，覆盖掉用户的真实位置。
  // 方案：① 仅监听用户主动滚动事件（wheel/touchmove/keydown），编程式 scrollTo 不会触发；
  //       ② 用 click 捕获在导航发生前用真实 scrollY 同步落盘，规避 effect 顺序不确定。
  useEffect(() => {
    const save = () => sessionStorage.setItem(scrollStorageKey, String(window.scrollY));
    let rafId: number | null = null;
    const onUserScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        save();
        rafId = null;
      });
    };
    // 用户点击（包括卡片链接、侧边栏标签按钮等可能触发导航的元素）时立刻落盘
    const onClickCapture = () => {
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

  const tagSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    data.tags.forEach((tag) => map.set(getTagSlug(tag), tag.id));
    return map;
  }, [data.tags]);

  const activeTag = useMemo(() => {
    if (!section) return 'all';
    if (section === 'recommended') return 'recommended';
    if (section === 'watching') return 'watching';
    return tagSlugMap.get(section) || 'all';
  }, [section, tagSlugMap]);

  // 切换活动分区 / 搜索 / 排序时，如果已滚出列表头部则不再用 stagger 动画
  useEffect(() => {
    setStaggerCards(window.scrollY < 120);
  }, [activeTag, searchTerm, sortConfig.key, sortConfig.order]);

  useEffect(() => {
    if (data.settings.title) {
      document.title = data.settings.title;
    }
    if (data.settings.iconUrl) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
      if (favicon) favicon.href = data.settings.iconUrl;
    }
  }, [data.settings.title, data.settings.iconUrl]);

  // 无效分区 fallback 到首页
  useEffect(() => {
    if (!section) return;
    if (section === 'recommended' || section === 'watching') return;
    if (tagSlugMap.has(section)) return;
    navigate('/', { replace: true });
  }, [section, tagSlugMap, navigate]);

  // 旧链接 ?tag=xxx 迁移到 path 形式
  useEffect(() => {
    if (section) return;
    const legacyTag = searchParams.get('tag');
    if (!legacyTag) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tag');
    const query = nextParams.toString();
    const suffix = query ? `?${query}` : '';

    if (legacyTag === 'recommended' || legacyTag === 'watching') {
      navigate(`/${legacyTag}${suffix}`, { replace: true });
      return;
    }

    const tagById = data.tags.find((tag) => tag.id === legacyTag);
    if (tagById) {
      navigate(`/${getTagSlug(tagById)}${suffix}`, { replace: true });
      return;
    }

    if (tagSlugMap.has(legacyTag)) {
      navigate(`/${legacyTag}${suffix}`, { replace: true });
    }
  }, [section, searchParams, data.tags, tagSlugMap, navigate]);

  const resetListView = () => {
    setVisibleCount(INITIAL_LOAD_COUNT);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setIsLoadingMore(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hero 轮播卡片集合（只取前 10 个推荐）
  const heroCards = useMemo(() => {
    const recommended = data.cards.filter(c => c.isRecommended);
    const shuffled = [...recommended].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [data.cards]);

  const showHero = activeTag === 'all' && !searchTerm && heroCards.length > 0;

  const hero = useHeroRotation(heroCards.length, showHero);

  // --- 事件处理 ---

  const handleTagChange = (tagId: string) => {
    const path =
      tagId === 'all'
        ? '/'
        : tagId === 'recommended'
          ? '/recommended'
          : tagId === 'watching'
            ? '/watching'
            : (() => {
                const tag = data.tags.find((item) => item.id === tagId);
                return tag ? `/${getTagSlug(tag)}` : '/';
              })();
    navigate(path + location.search);
    resetListView();
  };

  const handleSortChange = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      order: prev.key === key ? (prev.order === 'desc' ? 'asc' : 'desc') : 'desc'
    }));
    resetListView();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (val) newParams.set('q', val);
      else newParams.delete('q');
      return newParams;
    }, { replace: true });

    setVisibleCount(INITIAL_LOAD_COUNT);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('q');
      return newParams;
    });
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

  const cardStats = useMemo(() => buildCardStats(data.cards), [data.cards]);

  // 首次卡片渲染后，按 sessionStorage 中的位置恢复滚动（仅恢复一次）。
  // useLayoutEffect 在 paint 前执行，避免出现"先到顶部再跳到记忆位置"的闪烁
  useLayoutEffect(() => {
    if (hasRestoredScrollRef.current) return;
    if (filteredCards.length === 0) return;

    const saved = sessionStorage.getItem(scrollStorageKey);
    hasRestoredScrollRef.current = true;
    if (!saved) return;

    const y = parseInt(saved, 10);
    if (!Number.isFinite(y) || y <= 0) return;

    // 多帧重试：等卡片网格布局完成后再恢复，防止页面高度尚未撑起导致 scrollTo 被夹紧
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
  const sectionCardLimit = Math.max(gridColumns * 2, 2);

  const structuredHomeSections = useStructuredHomeSections({
    isStructuredHome, heroCards, filteredCards, tags: data.tags,
    gridColumns, showHero, sectionCardLimit
  });

  // --- 瀑布流加载 ---
  const loadRef = useRef<HTMLDivElement>(null);
  const hasMore = !isStructuredHome && visibleCount < filteredCards.length;

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
  }, [hasMore, isLoadingMore, filteredCards.length]);

  // --- 创建卡片 ---
  const handleCreateSave = async (cardData: Partial<CardData>) => {
    try {
      const newCards = [...data.cards];
      const now = Date.now();
      const draftCard: CardData = {
        id: now.toString(),
        title: cardData.title || 'Untitled',
        coverUrl: cardData.coverUrl || '',
        coverLocalData: cardData.coverLocalData || '',
        description: cardData.description || '',
        startDate: cardData.startDate || '',
        endDate: cardData.endDate || '',
        rating: cardData.rating || 0,
        tagIds: cardData.tagIds || [],
        isRecommended: !!cardData.isRecommended,
        isWatching: !!cardData.isWatching,
        createdAt: now,
        updatedAt: now
      };

      const newCard = await persistCardCover(draftCard);
      newCards.push(newCard);

      const result = await getStorage().savePublicData({ ...data, cards: newCards });
      if (result.success) {
        await refreshData();
        setIsCreateModalOpen(false);
        showToast('创建成功', 'success');
      } else {
        showToast(result.error || '失败', 'error');
      }
    } catch (e: any) {
      showToast(`封面处理失败: ${e?.message || '未知错误'}`, 'error');
    }
  };

  const gridKey = `${activeTag}-${searchTerm}-${sortConfig.key}-${sortConfig.order}`;

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

  const quickCreateInitialCard = useMemo<Partial<CardData>>(
    () => ({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false, isWatching: false }),
    []
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row selection:bg-amber-500/80 selection:text-white dark:selection:bg-amber-200 dark:selection:text-black transition-colors duration-300">
      <PublicSidebar
        iconUrl={data.settings.iconUrl}
        title={data.settings.title}
        tags={data.tags}
        activeTag={activeTag}
        totalCards={data.cards.length}
        cardStats={cardStats}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onTagChange={handleTagChange}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 px-5 md:px-8 lg:px-10 pt-5 md:pt-8 lg:pt-10 overflow-x-hidden flex flex-col min-h-[100dvh]">
        <PublicMobileTagBar
          iconUrl={data.settings.iconUrl}
          title={data.settings.title}
          tags={data.tags}
          activeTag={activeTag}
          onTagChange={handleTagChange}
        />

        <PublicToolbar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onClearSearch={clearSearch}
          sortKey={sortConfig.key}
          sortOrder={sortConfig.order}
          onSortChange={handleSortChange}
          isAdmin={isAdmin}
          onCreateClick={() => setIsCreateModalOpen(true)}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        {filteredCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-28 text-[color:var(--text-secondary)]/60">
            <Grid size={60} className="mb-4 stroke-[1.2]" />
            <p className="font-display text-2xl mb-2">暂无匹配内容</p>
            <p className="text-sm tracking-[0.18em] uppercase">Try another filter</p>
          </div>
        ) : isStructuredHome && structuredHomeSections ? (
          <PublicStructuredHome
            sections={structuredHomeSections}
            gridKey={gridKey}
            staggerCards={staggerCards}
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
          />
        ) : (
          <>
            {activeTag !== 'all' && !searchTerm && (
              <div key={activeTag} className="mb-8 fade-up text-center">
                <h3 className="fade-up font-display text-3xl text-[color:var(--text-primary)] inline-flex w-full items-center justify-center gap-2" style={{ animationDelay: '0.06s' }}>
                  <span className="w-7 h-7 inline-flex items-center justify-center text-[color:var(--accent)]">{activeTagLeadIcon}</span>
                  {activeTagLabel}
                </h3>
              </div>
            )}
            <PublicCardGrid
              gridKey={gridKey}
              filteredCards={filteredCards}
              visibleCount={visibleCount}
              staggerCards={staggerCards}
              showHero={showHero}
              heroCards={heroCards}
              heroIndex={hero.heroIndex}
              setHeroIndex={hero.setHeroIndex}
              setIsHeroPaused={hero.setIsHeroPaused}
              onTouchStart={hero.onTouchStart}
              onTouchMove={hero.onTouchMove}
              onTouchEnd={hero.onTouchEnd}
              getCardHref={(card) =>
                activeSectionSlug ? getCardHrefBySection(card, activeSectionSlug) : getCardHrefBySection(card)
              }
              getCardState={getCardLinkState}
            />
          </>
        )}

        {!isStructuredHome && (hasMore || isLoadingMore) && (
          <div ref={loadRef} className="flex justify-center mt-16 pb-8 min-h-[50px]">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-[color:var(--text-secondary)]/80 text-xs font-semibold uppercase tracking-[0.2em]">
                <Loader2 className="animate-spin" size={14} />
                <span>Loading More</span>
              </div>
            )}
            {!isLoadingMore && hasMore && <div className="h-4 w-full" />}
          </div>
        )}

        {!isStructuredHome && !hasMore && filteredCards.length > 0 && (
          <div className="text-center mt-16 pb-8 text-xs font-semibold text-[color:var(--text-secondary)]/70 uppercase tracking-[0.24em] fade-up" style={{ animationDelay: '0.08s' }}>
            End of Collection
          </div>
        )}

        <footer className="mt-auto pt-16 pb-6">
          <div className="h-px bg-gradient-to-r from-transparent via-[color:var(--line)] to-transparent" />
          <div className="pt-6 flex flex-col items-center gap-1.5 text-xs text-[color:var(--text-secondary)]">
            <p className="font-semibold">{data.settings.footerLeft || `© ${new Date().getFullYear()}`}</p>
            <p>{data.settings.footerRight || data.settings.footerText || 'All rights reserved'}</p>
          </div>
        </footer>

        <button
          onClick={scrollToTop}
          className={`fixed bottom-20 right-6 z-50 w-11 h-11 glass-panel text-[color:var(--text-primary)] rounded-2xl shadow-lg border border-[color:var(--line)] transition-all duration-300 transform flex items-center justify-center ${showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        >
          <ArrowUp size={18} />
        </button>
      </main>

      <Suspense fallback={null}>
        <CardEditModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="快速记录"
          initialCard={quickCreateInitialCard}
          tags={data.tags}
          onSave={handleCreateSave}
        />
      </Suspense>
    </div>
  );
};
