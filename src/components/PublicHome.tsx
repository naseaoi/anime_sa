
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, Search, X, ChevronLeft, ChevronRight, ThumbsUp, ArrowUpDown, Star, Grid, Loader2, Plus, PlayCircle, Moon, Sun, Monitor, ArrowUp } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { ImagePreview, useToast, useTheme } from './Common';
import { CardEditModal } from './CardEditModal';
import { getStorage } from '../services/storageFactory';

// --- 排序类型定义 ---
type SortKey = 'createdAt' | 'rating' | 'updatedAt';
type SortOrder = 'desc' | 'asc';

const INITIAL_LOAD_COUNT = 32;
const LOAD_MORE_COUNT = 20;

interface PublicHomeProps {
  data: PublicData;
  refreshData: () => Promise<void>;
  isAdmin: boolean;
}

export const PublicHome: React.FC<PublicHomeProps> = ({ data, refreshData, isAdmin }) => {
  const [searchParams, setSearchParams] = useSearchParams();
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

  // 创建卡片相关状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { showToast } = useToast();

  // 持久化 visibleCount 和 sortConfig
  useEffect(() => {
    sessionStorage.setItem('tat_visible_count', visibleCount.toString());
  }, [visibleCount]);

  useEffect(() => {
    sessionStorage.setItem('tat_sort_config', JSON.stringify(sortConfig));
  }, [sortConfig]);

  // 监听滚动显示回到顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 状态：标签 (默认为 all)
  const activeTag = searchParams.get('tag') || 'all';

  // --- 辅助函数：重置列表视口 ---
  const resetListView = () => {
    setVisibleCount(INITIAL_LOAD_COUNT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (tagId === 'all') {
        newParams.delete('tag'); // 如果是 all，直接移除参数，保持 URL 干净
      } else {
        newParams.set('tag', tagId);
      }
      return newParams;
    });
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
    let list = [...data.cards];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(term) || c.description.toLowerCase().includes(term));
    }
    
    // 标签筛选逻辑
    if (activeTag === 'recommended') {
      list = list.filter(c => c.isRecommended);
    } else if (activeTag === 'watching') {
      list = list.filter(c => c.isWatching);
    } else if (activeTag !== 'all') {
      list = list.filter(c => c.tagIds.includes(activeTag));
    }

    list.sort((a, b) => {
      const valA = a[sortConfig.key] || 0;
      const valB = b[sortConfig.key] || 0;
      return sortConfig.order === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
    });
    return list;
  }, [data.cards, activeTag, sortConfig, searchTerm]);

  // --- 瀑布流加载逻辑 ---
  const loadRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < filteredCards.length;

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
    const newCards = [...data.cards];
    const now = Date.now();
    const newCard: CardData = {
      id: now.toString(),
      title: cardData.title || 'Untitled',
      coverUrl: cardData.coverUrl || '',
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
    newCards.push(newCard);
    
    const result = await getStorage().savePublicData({ ...data, cards: newCards });
    if (result.success) {
       await refreshData();
       setIsCreateModalOpen(false);
       showToast('创建成功', 'success');
    } else {
       showToast(result.error || '失败', 'error');
    }
  };

  const gridKey = `${activeTag}-${searchTerm}-${sortConfig.key}-${sortConfig.order}`;

  // Theme Icon Logic
  const ThemeIcon = useMemo(() => {
    if (theme === 'light') return Sun;
    if (theme === 'dark') return Moon;
    return Monitor;
  }, [theme]);

  return (
    <div className="min-h-screen bg-[#f8f8f7] dark:bg-[#0c0c0c] flex flex-col lg:flex-row font-sans selection:bg-ink selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-300">
      {/* 侧边导航 */}
      <aside className="hidden lg:flex lg:w-64 lg:h-screen lg:sticky lg:top-0 bg-white dark:bg-[#18181b] border-r border-stone-200 dark:border-zinc-800 p-8 flex-col z-40 transition-colors duration-300">
        <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={() => window.location.href = '/'}>
          <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
          <h1 className="font-bold text-lg text-ink dark:text-zinc-100 tracking-tight">{data.settings.title}</h1>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1">
          <button onClick={() => handleTagChange('all')} className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all ${activeTag === 'all' ? 'bg-ink text-white shadow-md dark:bg-zinc-100 dark:text-black' : 'text-subtle dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}>
            <div className="flex items-center gap-2"><LayoutGrid size={14} /><span className="text-sm font-semibold">全部展示</span></div>
            <span className="text-[10px] font-mono opacity-60">{data.cards.length}</span>
          </button>
          
          <button onClick={() => handleTagChange('recommended')} className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all mt-1 ${activeTag === 'recommended' ? 'bg-amber-500 text-white shadow-md' : 'text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>
            <div className="flex items-center gap-2"><ThumbsUp size={14} /><span className="text-sm font-semibold">精选推荐</span></div>
            <span className="text-[10px] font-mono opacity-60">{data.cards.filter(c => c.isRecommended).length}</span>
          </button>

          <button onClick={() => handleTagChange('watching')} className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all mt-1 ${activeTag === 'watching' ? 'bg-blue-500 text-white shadow-md' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
            <div className="flex items-center gap-2"><PlayCircle size={14} /><span className="text-sm font-semibold">正在观看</span></div>
            <span className="text-[10px] font-mono opacity-60">{data.cards.filter(c => c.isWatching).length}</span>
          </button>

          <div className="h-px bg-stone-100 dark:bg-zinc-800 my-4 mx-4" />
          {data.tags.map(tag => (
            <button key={tag.id} onClick={() => handleTagChange(tag.id)} className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all ${activeTag === tag.id ? 'bg-ink text-white shadow-md dark:bg-zinc-100 dark:text-black' : 'text-subtle dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`}>
              <span className="text-sm font-semibold">{tag.name}</span>
              <span className="text-[10px] font-mono opacity-60">{data.cards.filter(c => c.tagIds.includes(tag.id)).length}</span>
            </button>
          ))}
        </nav>

        {/* Web端侧边栏底部的 Theme Toggle */}
        <div className="mt-auto pt-4 border-t border-stone-100 dark:border-zinc-800">
           <button 
             onClick={toggleTheme} 
             className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-400 hover:text-ink hover:bg-stone-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
             title={`Theme: ${theme}`}
           >
             <ThemeIcon size={18} />
           </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-x-hidden flex flex-col">
        {/* 移动端头部 */}
        <div className="lg:hidden flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3" onClick={() => window.location.href = '/'}>
            <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
            <h1 className="font-bold text-lg text-ink dark:text-zinc-100 tracking-tight">{data.settings.title}</h1>
          </div>
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2 mask-linear-fade">
             <button onClick={() => handleTagChange('all')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'all' ? 'bg-ink text-white shadow-md dark:bg-zinc-100 dark:text-black' : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-subtle dark:text-zinc-400'}`} title="全部展示"><LayoutGrid size={18} /></button>
             
             <button onClick={() => handleTagChange('recommended')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'recommended' ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-amber-600 dark:text-amber-500'}`} title="推荐"><ThumbsUp size={18} /></button>
             
             <button onClick={() => handleTagChange('watching')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'watching' ? 'bg-blue-500 text-white shadow-md' : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400'}`} title="观看中"><PlayCircle size={18} /></button>

             {data.tags.map(tag => (
                <button key={tag.id} onClick={() => handleTagChange(tag.id)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${activeTag === tag.id ? 'bg-ink text-white shadow-md dark:bg-zinc-100 dark:text-black' : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-subtle dark:text-zinc-400'}`}>{tag.name}</button>
             ))}
          </div>
        </div>

        {/* 顶部工具栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
           <div className="flex gap-4 w-full sm:w-auto">
             <div className="relative w-full sm:w-80 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 dark:text-zinc-600 group-focus-within:text-ink dark:group-focus-within:text-zinc-300 transition-colors" size={16} />
               <input type="text" placeholder="搜索" value={searchTerm} onChange={handleSearchChange} className="w-full bg-white dark:bg-[#18181b] border border-stone-200 dark:border-zinc-800 rounded-2xl py-3 pl-12 pr-10 text-sm font-bold text-ink dark:text-zinc-200 focus:outline-none focus:border-ink dark:focus:border-zinc-500 focus:ring-8 focus:ring-stone-200/50 dark:focus:ring-zinc-800/50 transition-all" />
               {searchTerm && <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink dark:hover:text-zinc-100"><X size={16} /></button>}
             </div>
             {isAdmin && (
                <button onClick={() => setIsCreateModalOpen(true)} className="bg-white dark:bg-[#18181b] border border-stone-200 dark:border-zinc-800 text-stone-400 dark:text-zinc-500 hover:text-ink dark:hover:text-zinc-200 hover:border-ink dark:hover:border-zinc-500 rounded-2xl w-12 flex items-center justify-center transition-all shadow-sm active:scale-95" title="快速添加">
                  <Plus size={20} />
                </button>
             )}
           </div>
           
           <div className="flex items-center gap-2">
             <div className="flex bg-stone-100 dark:bg-[#18181b] p-1.5 rounded-xl">
               {(['createdAt', 'rating', 'updatedAt'] as SortKey[]).map(key => (
                 <button key={key} onClick={() => handleSortChange(key)} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${sortConfig.key === key ? 'bg-white dark:bg-zinc-800 text-ink dark:text-zinc-200 shadow-sm' : 'text-stone-400 dark:text-zinc-600 hover:text-stone-600 dark:hover:text-zinc-400'}`}>
                   {key === 'createdAt' ? '创建' : key === 'rating' ? '评分' : '更新'}
                   {sortConfig.key === key && <ArrowUpDown size={10} className={sortConfig.order === 'asc' ? 'rotate-180 transition-transform' : ''} />}
                 </button>
               ))}
             </div>
             {/* Mobile/Tablet Toggle Button (Right of Sort) */}
             <button 
                onClick={toggleTheme} 
                className="lg:hidden p-3 bg-stone-100 dark:bg-[#18181b] rounded-xl text-stone-400 hover:text-ink dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors"
             >
                <ThemeIcon size={18} />
             </button>
           </div>
        </div>

        {filteredCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-32 opacity-20 text-ink dark:text-zinc-400"><Grid size={64} className="mb-4 stroke-[1]" /><p className="font-bold uppercase tracking-widest">NO DATA</p></div>
        ) : (
          <div key={gridKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 auto-rows-min">
            {/* Hero Carousel */}
            {showHero && (
              <div className="group relative sm:col-span-2 sm:row-span-2 aspect-video w-full isolate touch-pan-y">
                <div className="w-full h-full" onMouseEnter={() => setIsHeroPaused(true)} onMouseLeave={() => setIsHeroPaused(false)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                    <div className="absolute inset-0 rounded-2xl shadow-[0_0_15px_rgba(251,191,36,0.6)] ring-1 ring-amber-400 overflow-hidden" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                      {heroCards.map((card, idx) => (
                        <Link key={card.id} to={`/card/${card.id}`} className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${idx === heroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} draggable={false}>
                          <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full object-cover select-none" />
                          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                          <div className="absolute top-0 left-0 bg-amber-400 text-white p-2.5 rounded-br-2xl shadow-lg z-10"><ThumbsUp size={24} /></div>
                          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5"><Star size={12} className="text-amber-400 fill-amber-400" /><span className="text-xs font-black text-ink">{card.rating.toFixed(1)}</span></div>
                          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white drop-shadow-md z-20">
                            {/* Mobile Optimization: Smaller text, limited lines */}
                            <h3 className="text-lg sm:text-3xl font-black leading-tight line-clamp-2 mb-1 sm:mb-2">{card.title}</h3>
                            <p className="text-white/90 text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 font-medium">{card.description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {/* Controls */}
                    {heroCards.length > 1 && (
                      <>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex(prev => (prev - 1 + heroCards.length) % heroCards.length); }} className="absolute -left-2 top-1/2 -translate-y-1/2 p-2 text-white z-30 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:bg-black/20 lg:hover:bg-black/40 lg:backdrop-blur-sm lg:rounded-full drop-shadow-md lg:left-2"><ChevronLeft size={24} /></button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex(prev => (prev + 1) % heroCards.length); }} className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 text-white z-30 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:bg-black/20 lg:hover:bg-black/40 lg:backdrop-blur-sm lg:rounded-full drop-shadow-md lg:right-2"><ChevronRight size={24} /></button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 pointer-events-none">{heroCards.map((_, idx) => (<div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === heroIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} />))}</div>
                      </>
                    )}
                </div>
              </div>
            )}
            {/* Grid */}
            {filteredCards.slice(0, visibleCount).map((card) => (
              <Link key={card.id} to={`/card/${card.id}`} className="group cursor-pointer fill-mode-both">
                  <div className={`relative rounded-2xl transition-all duration-500 group-hover:shadow-2xl group-hover:scale-[1.02] h-full w-full aspect-video ${
                    card.isWatching 
                      ? 'border-2 border-dashed border-blue-400 bg-blue-50/10 dark:bg-blue-900/10' // 观看中样式（优先级高）
                      : card.isRecommended 
                        ? 'border-2 border-white dark:border-white ring-1 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' 
                        : 'bg-stone-200 dark:bg-zinc-900 shadow-sm'
                  }`}>
                    {/* 
                       Change: Moved Badges OUTSIDE the overflow-hidden container.
                       Added -top-[2px] -left-[2px] to cover the white border in dark mode.
                       Added rounded-tl-2xl to match the outer curve.
                    */}
                    <div className="w-full h-full rounded-2xl overflow-hidden relative isolate" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                      <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full transition-transform duration-1000 group-hover:scale-110" />
                      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      
                      <div className="absolute top-3 right-3 flex gap-2"><div className="bg-white/95 dark:bg-black/80 backdrop-blur-md border border-white/20 dark:border-white/10 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5"><Star size={12} className="text-amber-400 fill-amber-400" /><span className="text-xs font-black text-ink dark:text-zinc-200">{card.rating.toFixed(1)}</span></div></div>
                      <div className="absolute bottom-0 left-0 right-0 text-white drop-shadow-md flex flex-col justify-end p-4">
                        <h3 className="text-lg font-black leading-tight line-clamp-2 origin-bottom-left transition-transform duration-300">{card.title}</h3>
                        {/* 
                           Change: grid-rows-1 by default (Mobile), lg:grid-rows-0 (Desktop default), lg:group-hover:grid-rows-1 (Desktop hover)
                           This prioritizes showing the description on mobile.
                        */}
                        <div className="grid grid-rows-[1fr] lg:grid-rows-[0fr] lg:group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-out">
                          <div className="overflow-hidden">
                            <p className="text-white/90 pt-2 line-clamp-2 font-medium text-[10px]">{card.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 推荐图标 (Moved Outside) */}
                    {card.isRecommended && (
                      <div className="absolute -top-[2px] -left-[2px] bg-amber-400 text-white p-2.5 rounded-br-2xl rounded-tl-2xl shadow-lg z-20 pointer-events-none">
                        <ThumbsUp size={16} />
                      </div>
                    )}
                    
                    {/* 观看中角标 (Moved Outside) */}
                    {card.isWatching && !card.isRecommended && (
                      <div className="absolute -top-[2px] -left-[2px] bg-blue-500 text-white p-2.5 rounded-br-2xl rounded-tl-2xl shadow-lg z-20 pointer-events-none">
                        <PlayCircle size={16} />
                      </div>
                    )}

                  </div>
              </Link>
            ))}
          </div>
        )}

        {/* 底部加载状态控制 */}
        {(hasMore || isLoadingMore) && (
          <div ref={loadRef} className="flex justify-center mt-16 pb-8 min-h-[50px]">
            {isLoadingMore && (
              <div className="animate-pulse flex items-center gap-2 text-stone-300 dark:text-zinc-600 text-xs font-bold uppercase tracking-widest">
                 <Loader2 className="animate-spin" size={14} />
                 <span>Loading more</span>
              </div>
            )}
            {!isLoadingMore && hasMore && <div className="h-4 w-full" />}
          </div>
        )}

        {!hasMore && filteredCards.length > 0 && (
          <div className="text-center mt-16 pb-8 text-xs font-bold text-stone-300 dark:text-zinc-700 uppercase tracking-widest">
            — End of Collection —
          </div>
        )}

        {/* 回到顶部按钮 */}
        <button 
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-50 p-3 bg-white dark:bg-zinc-800 text-ink dark:text-zinc-200 rounded-full shadow-lg border border-stone-100 dark:border-zinc-700 transition-all duration-300 transform ${showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
        >
          <ArrowUp size={20} />
        </button>

      </main>

      <CardEditModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="快速记录"
        initialCard={{ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false, isWatching: false }}
        tags={data.tags}
        onSave={handleCreateSave}
      />
    </div>
  );
};
