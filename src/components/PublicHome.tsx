
import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Search, X, ThumbsUp, ArrowUpDown, Grid, Loader2, Plus, PlayCircle, Moon, Sun, Monitor, ArrowUp, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { useToast, useTheme } from './Common';
import { getStorage } from '../services/storageFactory';
import { persistCardCover } from '../services/coverAssetService';
import { PublicCardGrid } from './public/PublicCardGrid';
import { buildCardStats } from '../utils/cardStats';
import { getTagSlug, sectionFromCard } from '../utils/routeUtils';
import { getTagIcon } from '../utils/tagIcons';

const CardEditModal = React.lazy(() => import('./CardEditModal').then((m) => ({ default: m.CardEditModal })));

// --- 排序类型定义 ---
type SortKey = 'createdAt' | 'rating' | 'updatedAt';
type SortOrder = 'desc' | 'asc';

const INITIAL_LOAD_COUNT = 32;
const LOAD_MORE_COUNT = 20;

const getGridColumns = (width: number) => {
  if (width >= 1536) return 5;
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
};

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
  
  // 1. 状态初始化：优先从 SessionStorage 读取，保证返回时状态一致
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

  // 状态：搜索词 (URL 为准)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  
  // 状态：加载中 (用于显示底部 Spinner)
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 状态：回到顶部按钮显示
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollIdleTimerRef = useRef<number | null>(null);

  // 创建卡片相关状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { showToast } = useToast();
  const [gridColumns, setGridColumns] = useState(() => getGridColumns(window.innerWidth));
  const [staggerCards, setStaggerCards] = useState(() => window.scrollY < 120);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tat_public_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  // 持久化 visibleCount 和 sortConfig
  useEffect(() => {
    sessionStorage.setItem('tat_visible_count', visibleCount.toString());
  }, [visibleCount]);

  useEffect(() => {
    sessionStorage.setItem('tat_sort_config', JSON.stringify(sortConfig));
  }, [sortConfig]);

  useEffect(() => {
    localStorage.setItem('tat_public_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  // 监听滚动显示回到顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 300;
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
      }, 2000);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setGridColumns(getGridColumns(window.innerWidth));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    if (!section) return;
    if (section === 'recommended' || section === 'watching') return;
    if (tagSlugMap.has(section)) return;
    navigate('/', { replace: true });
  }, [section, tagSlugMap, navigate]);

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

  // --- 辅助函数：重置列表视口 ---
  const resetListView = () => {
    setVisibleCount(INITIAL_LOAD_COUNT);
    window.scrollTo({ top: 0, behavior: 'auto' });
    setIsLoadingMore(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Hero 轮播逻辑 ---
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
    if (!touchStart.current || !touchEnd.current) return;
    const distance = touchStart.current - touchEnd.current;
    if (distance > 50) setHeroIndex(prev => (prev + 1) % heroCards.length);
    if (distance < -50) setHeroIndex(prev => (prev - 1 + heroCards.length) % heroCards.length);
  };

  const heroCards = useMemo(() => {
    const recommended = data.cards.filter(c => c.isRecommended);
    const shuffled = [...recommended].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [data.cards]);
  
  const showHero = activeTag === 'all' && !searchTerm && heroCards.length > 0;

  useEffect(() => {
    if (!showHero || isHeroPaused || heroCards.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroCards.length);
    }, 4000); 
    return () => clearInterval(timer);
  }, [showHero, isHeroPaused, heroCards.length]);


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

  const isStructuredHome = activeTag === 'all' && !searchTerm;

  const sectionCardLimit = Math.max(gridColumns * 2, 2);

  const structuredHomeSections = useMemo(() => {
    if (!isStructuredHome) return null;

    const heroIds = new Set(heroCards.map((card) => card.id));
    const heroArea = showHero && gridColumns >= 2 ? 4 : 0;
    const topCardsTarget = Math.max(sectionCardLimit - heroArea, 0);

    const nonHeroCards: CardData[] = [];
    const recommendedCards: CardData[] = [];
    const watchingCards: CardData[] = [];
    const cardsByTag = new Map<string, CardData[]>();
    const usedCardIds = new Set<string>();

    data.tags.forEach((tag) => {
      cardsByTag.set(tag.id, []);
    });

    for (const card of filteredCards) {
      if (!heroIds.has(card.id)) {
        nonHeroCards.push(card);
      }
    }

    for (const card of nonHeroCards) {
      if (card.isRecommended) {
        recommendedCards.push(card);
        usedCardIds.add(card.id);
      }
    }

    for (const card of nonHeroCards) {
      if (usedCardIds.has(card.id)) continue;
      if (card.isWatching) {
        watchingCards.push(card);
        usedCardIds.add(card.id);
      }
    }

    const topCandidates = nonHeroCards.filter((card) => !usedCardIds.has(card.id));
    const topCandidatesSorted = [...topCandidates].sort((a, b) => {
      const aHasTag = a.tagIds.length > 0;
      const bHasTag = b.tagIds.length > 0;
      if (aHasTag === bHasTag) return 0;
      return aHasTag ? 1 : -1;
    });
    const topCards = topCandidatesSorted.slice(0, topCardsTarget);
    topCards.forEach((card) => usedCardIds.add(card.id));

    for (const card of nonHeroCards) {
      if (usedCardIds.has(card.id)) continue;
      const matchedTag = data.tags.find((tag) => card.tagIds.includes(tag.id));
      if (matchedTag) {
        const bucket = cardsByTag.get(matchedTag.id);
        if (bucket) {
          bucket.push(card);
          usedCardIds.add(card.id);
        }
      }
    }

    const tagSections = data.tags
      .map((tag) => ({ tag, cards: cardsByTag.get(tag.id) || [] }))
      .filter((section) => section.cards.length > 0);

    return { topCards, recommendedCards, watchingCards, tagSections };
  }, [isStructuredHome, heroCards, filteredCards, data.tags, gridColumns, showHero, sectionCardLimit]);

  // --- 瀑布流加载逻辑 ---
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

  // Theme Icon Logic
  const quickCreateInitialCard = useMemo<Partial<CardData>>(
    () => ({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false, isWatching: false }),
    []
  );

  // Theme Icon Logic
  const ThemeIcon = useMemo(() => {
    if (theme === 'light') return Sun;
    if (theme === 'dark') return Moon;
    return Monitor;
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row selection:bg-amber-500/80 selection:text-white dark:selection:bg-amber-200 dark:selection:text-black transition-colors duration-300">
      {/* 侧边导航 */}
      <aside className={`hidden lg:flex ${sidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} lg:h-screen lg:sticky lg:top-0 p-5 lg:px-5 flex-col z-40 border-r border-[color:var(--line)] bg-[color:var(--surface-muted)] backdrop-blur-xl transition-all duration-300`}>
        <div className="fade-up mb-10 cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="relative h-9">
            <img
              src={data.settings.iconUrl}
              alt="Logo"
              className={`absolute top-0 w-9 h-9 object-contain transition-[left,transform] ease-in-out ${sidebarCollapsed ? 'left-1/2 -translate-x-1/2' : 'left-0 translate-x-0'}`}
              style={{ transitionDuration: sidebarCollapsed ? '340ms' : '680ms' }}
            />
            <div className={`absolute left-12 top-1/2 -translate-y-1/2 overflow-hidden transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'max-w-0 opacity-0 translate-x-1' : 'max-w-[180px] opacity-100 translate-x-0'}`}>
              <p className="font-display text-xl leading-tight text-[color:var(--text-primary)] whitespace-nowrap">{data.settings.title}</p>
              <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--text-secondary)] whitespace-nowrap">Cinema Archive</p>
            </div>
          </div>
        </div>

        <nav className="fade-up-delay-1 flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 pr-1">
          <button onClick={() => handleTagChange('all')} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === 'all' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
            <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-[color:var(--accent)] transition-opacity ${activeTag === 'all' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
            <div className="flex items-center gap-2 min-w-0">
              <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><LayoutGrid size={14} /></span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>全部展示</span>
            </div>
            <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{data.cards.length}</span>
          </button>

          <button onClick={() => handleTagChange('recommended')} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === 'recommended' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
            <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-amber-500 transition-opacity ${activeTag === 'recommended' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
            <div className="flex items-center gap-2 min-w-0">
              <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><ThumbsUp size={14} /></span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>精选推荐</span>
            </div>
            <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{cardStats.recommendedCount}</span>
          </button>

          <button onClick={() => handleTagChange('watching')} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === 'watching' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
            <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-sky-500 transition-opacity ${activeTag === 'watching' ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
            <div className="flex items-center gap-2 min-w-0">
              <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><PlayCircle size={14} /></span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>正在观看</span>
            </div>
            <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{cardStats.watchingCount}</span>
          </button>

          <div className="h-px bg-[color:var(--line)]/70 my-4 mx-4" />
          {data.tags.map(tag => (
            <button key={tag.id} onClick={() => handleTagChange(tag.id)} className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${activeTag === tag.id ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)] shadow-sm' : 'border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)]'}`}>
              <span className={`absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-[color:var(--accent)] transition-opacity ${activeTag === tag.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-4 h-4 flex items-center justify-center transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}>{getTagIcon(tag.icon, 'w-4 h-4') || <span className="text-[11px] font-bold">{tag.name.slice(0, 1)}</span>}</span>
                <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>{tag.name}</span>
              </div>
              <span className={`text-[10px] font-mono opacity-70 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-12 opacity-100 ml-2'}`}>{cardStats.tagCountMap.get(tag.id) || 0}</span>
            </button>
          ))}
        </nav>

        <div className="fade-up-delay-2 mt-auto pt-5 flex flex-col gap-1.5">
          <div className="h-px mb-1.5 bg-gradient-to-r from-transparent via-[color:var(--line)] to-transparent" />
          <button
            onClick={toggleTheme}
            className="group relative flex items-center px-3 py-2.5 rounded-xl border border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)] transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}><ThemeIcon size={14} /></span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>主题</span>
            </div>
          </button>

          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="group relative flex items-center px-3 py-2.5 rounded-xl border border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface)]/78 hover:border-[color:var(--line)] hover:text-[color:var(--text-primary)] transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`relative w-3.5 h-3.5 transition-transform duration-300 ${sidebarCollapsed ? 'translate-x-1.5' : 'translate-x-0'}`}>
                <span className={`absolute inset-0 flex items-center justify-center transition-all duration-[460ms] ease-in-out ${sidebarCollapsed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}><ChevronsLeft size={14} /></span>
                <span className={`absolute inset-0 flex items-center justify-center transition-all duration-[460ms] ease-in-out ${sidebarCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}><ChevronsRight size={14} /></span>
              </span>
              <span className={`text-sm font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>{sidebarCollapsed ? '展开' : '折叠'}</span>
            </div>
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 px-5 md:px-8 lg:px-10 pt-5 md:pt-8 lg:pt-10 overflow-x-hidden flex flex-col min-h-[100dvh]">
        {/* 移动端头部 */}
        <div className="lg:hidden fade-up flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3" onClick={() => window.location.href = '/'}>
            <img src={data.settings.iconUrl} alt="Logo" className="w-9 h-9 object-contain" />
            <div>
              <p className="font-display text-xl text-[color:var(--text-primary)] leading-tight">{data.settings.title}</p>
              <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--text-secondary)]">Cinema Archive</p>
            </div>
          </div>
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2 mask-linear-fade">
            <button onClick={() => handleTagChange('all')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 border ${activeTag === 'all' ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)]' : 'bg-[color:var(--surface)]/60 border-[color:var(--line)] text-[color:var(--text-secondary)]'}`} title="全部展示"><LayoutGrid size={18} /></button>

            <button onClick={() => handleTagChange('recommended')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'recommended' ? 'bg-amber-500 text-white shadow-md' : 'bg-[color:var(--surface)]/60 border border-[color:var(--line)] text-amber-700 dark:text-amber-400'}`} title="推荐"><ThumbsUp size={18} /></button>

            <button onClick={() => handleTagChange('watching')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'watching' ? 'bg-sky-500 text-white shadow-md' : 'bg-[color:var(--surface)]/60 border border-[color:var(--line)] text-sky-700 dark:text-sky-400'}`} title="观看中"><PlayCircle size={18} /></button>

            {data.tags.map(tag => (
              <button key={tag.id} onClick={() => handleTagChange(tag.id)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 border ${activeTag === tag.id ? 'bg-[color:var(--surface)]/85 border-[color:var(--line)] text-[color:var(--text-primary)]' : 'bg-[color:var(--surface)]/60 border-[color:var(--line)] text-[color:var(--text-secondary)]'}`}>{tag.name}</button>
            ))}
          </div>
        </div>

        {/* 顶部工具栏 */}
        <div className="sticky top-3 z-30 mb-8 fade-up-delay-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-96 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] group-focus-within:text-[color:var(--text-primary)] transition-colors" size={16} />
                <input type="text" placeholder="搜索标题或简介" value={searchTerm} onChange={handleSearchChange} className="w-full bg-[color:var(--surface)] border border-[color:var(--line)] rounded-2xl py-3 pl-12 pr-10 text-sm font-semibold text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]/70 focus:outline-none focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[color:var(--accent-soft)] transition-all" />
                {searchTerm && <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"><X size={16} /></button>}
              </div>
              {isAdmin && (
                <button onClick={() => setIsCreateModalOpen(true)} className="bg-[color:var(--surface)] border border-[color:var(--line)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:border-[color:var(--accent)] rounded-2xl w-12 flex items-center justify-center transition-all shadow-sm active:scale-95" title="快速添加">
                  <Plus size={20} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex bg-[color:var(--surface)] border border-[color:var(--line)] p-1 rounded-xl">
                {(['createdAt', 'rating', 'updatedAt'] as SortKey[]).map(key => (
                  <button key={key} onClick={() => handleSortChange(key)} className={`px-3.5 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 ${sortConfig.key === key ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}>
                    {key === 'createdAt' ? '创建' : key === 'rating' ? '评分' : '更新'}
                    {sortConfig.key === key && <ArrowUpDown size={10} className={sortConfig.order === 'asc' ? 'rotate-180 transition-transform' : ''} />}
                  </button>
                ))}
              </div>
              <button onClick={toggleTheme} className="lg:hidden p-3 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-xl text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                <ThemeIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-28 text-[color:var(--text-secondary)]/60">
            <Grid size={60} className="mb-4 stroke-[1.2]" />
            <p className="font-display text-2xl mb-2">暂无匹配内容</p>
            <p className="text-sm tracking-[0.18em] uppercase">Try another filter</p>
          </div>
        ) : isStructuredHome && structuredHomeSections ? (
          <div key={`sections-${gridKey}`} className="space-y-12">
            <section className="fade-up home-section-visibility" style={{ animationDelay: '0.02s' }}>
              <PublicCardGrid
                gridKey={`${gridKey}-hero-block`}
                filteredCards={structuredHomeSections.topCards}
                visibleCount={structuredHomeSections.topCards.length}
                staggerCards={staggerCards}
                showHero={showHero}
                heroCards={heroCards}
                heroIndex={heroIndex}
                setHeroIndex={setHeroIndex}
                setIsHeroPaused={setIsHeroPaused}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                getCardHref={(card) => getCardHrefBySection(card, 'all')}
                getCardState={getCardLinkState}
              />
            </section>

            {structuredHomeSections.recommendedCards.length > 0 && (
              <section className="space-y-4 fade-up home-section-visibility" style={{ animationDelay: '0.08s' }}>
                <div className="flex items-center justify-between gap-3 fade-up" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 inline-flex items-center justify-center text-amber-500"><ThumbsUp size={24} /></span>
                    <h3 className="font-display text-2xl text-[color:var(--text-primary)]">精选推荐</h3>
                    <span className="text-xs font-mono text-[color:var(--text-secondary)]">{structuredHomeSections.recommendedCards.length}</span>
                  </div>
                  {structuredHomeSections.recommendedCards.length > sectionCardLimit && (
                    <button onClick={() => handleTagChange('recommended')} className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                      查看更多
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
                <PublicCardGrid
                  gridKey={`${gridKey}-recommended-block`}
                  filteredCards={structuredHomeSections.recommendedCards.slice(0, sectionCardLimit)}
                  visibleCount={Math.min(structuredHomeSections.recommendedCards.length, sectionCardLimit)}
                  staggerCards={staggerCards}
                  showHero={false}
                  heroCards={[]}
                  heroIndex={0}
                  setHeroIndex={setHeroIndex}
                  setIsHeroPaused={setIsHeroPaused}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  getCardHref={(card) => getCardHrefBySection(card, 'recommended')}
                  getCardState={getCardLinkState}
                />
                {structuredHomeSections.recommendedCards.length > sectionCardLimit && (
                  <div className="flex justify-end pt-2 md:hidden">
                    <button onClick={() => handleTagChange('recommended')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                      查看更多
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </section>
            )}

            {structuredHomeSections.watchingCards.length > 0 && (
              <section className="space-y-4 fade-up home-section-visibility" style={{ animationDelay: '0.12s' }}>
                <div className="flex items-center justify-between gap-3 fade-up" style={{ animationDelay: '0.14s' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 inline-flex items-center justify-center text-sky-500"><PlayCircle size={24} /></span>
                    <h3 className="font-display text-2xl text-[color:var(--text-primary)]">正在观看</h3>
                    <span className="text-xs font-mono text-[color:var(--text-secondary)]">{structuredHomeSections.watchingCards.length}</span>
                  </div>
                  {structuredHomeSections.watchingCards.length > sectionCardLimit && (
                    <button onClick={() => handleTagChange('watching')} className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                      查看更多
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
                <PublicCardGrid
                  gridKey={`${gridKey}-watching-block`}
                  filteredCards={structuredHomeSections.watchingCards.slice(0, sectionCardLimit)}
                  visibleCount={Math.min(structuredHomeSections.watchingCards.length, sectionCardLimit)}
                  staggerCards={staggerCards}
                  showHero={false}
                  heroCards={[]}
                  heroIndex={0}
                  setHeroIndex={setHeroIndex}
                  setIsHeroPaused={setIsHeroPaused}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  getCardHref={(card) => getCardHrefBySection(card, 'watching')}
                  getCardState={getCardLinkState}
                />
                {structuredHomeSections.watchingCards.length > sectionCardLimit && (
                  <div className="flex justify-end pt-2 md:hidden">
                    <button onClick={() => handleTagChange('watching')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                      查看更多
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </section>
            )}

            {structuredHomeSections.tagSections.map((section, index) => (
              <section key={section.tag.id} className="space-y-5 fade-up home-section-visibility" style={{ animationDelay: `${0.18 + index * 0.04}s` }}>
                <div className="relative flex items-center justify-between py-1.5 fade-up" style={{ animationDelay: `${0.2 + index * 0.04}s` }}>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-2xl text-[color:var(--text-primary)] inline-flex items-center gap-2">
                      <span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]">{getTagIcon(section.tag.icon, 'w-6 h-6') || <span className="text-2xl font-bold leading-none">|</span>}</span>
                      {section.tag.name}
                    </h3>
                    <span className="text-xs font-mono text-[color:var(--text-secondary)]">{section.cards.length}</span>
                  </div>
                  {section.cards.length > sectionCardLimit && (
                    <button onClick={() => handleTagChange(section.tag.id)} className="hidden md:inline-flex absolute right-0 items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                      查看更多
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
                <PublicCardGrid
                  gridKey={`${gridKey}-tag-${section.tag.id}`}
                  filteredCards={section.cards.slice(0, sectionCardLimit)}
                  visibleCount={Math.min(section.cards.length, sectionCardLimit)}
                  staggerCards={staggerCards}
                  showHero={false}
                  heroCards={[]}
                  heroIndex={0}
                  setHeroIndex={setHeroIndex}
                  setIsHeroPaused={setIsHeroPaused}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  getCardHref={(card) => getCardHrefBySection(card, getTagSlug(section.tag))}
                  getCardState={getCardLinkState}
                />
                {section.cards.length > sectionCardLimit && (
                  <div className="flex justify-end pt-2 md:hidden">
                    <button onClick={() => handleTagChange(section.tag.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
                      查看更多
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
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
              heroIndex={heroIndex}
              setHeroIndex={setHeroIndex}
              setIsHeroPaused={setIsHeroPaused}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
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
