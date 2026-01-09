import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, Search, X, ChevronLeft, ChevronRight, ChevronDown, ThumbsUp, ArrowUpDown, Star, Grid, Loader2 } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA } from './services/webdavService';
import { PublicData } from './types';
import { Button, PageLoader, ImagePreview, Rating, ToastProvider } from './components/Common';
import { PublicDetail } from './components/PublicDetail';
import { AdminLayout } from './components/Admin';

// --- 主程序 ---

const App: React.FC = () => {
  return (
    <ToastProvider>
      <MainRouter />
    </ToastProvider>
  );
};

const MainRouter: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicData>(DEFAULT_PUBLIC_DATA);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await webdav.getPublicData();
    setData(result);
    document.title = result.settings.title;
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    if (favicon && result.settings.iconUrl) favicon.href = result.settings.iconUrl;
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <PageLoader />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHome data={data} />} />
        <Route path="/card/:id" element={<PublicDetail data={data} refreshData={fetchData} />} />
        <Route path="/tat/*" element={<AdminLayout initialData={data} refreshData={fetchData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// --- 排序类型定义 ---
type SortKey = 'createdAt' | 'rating' | 'updatedAt';
type SortOrder = 'desc' | 'asc';

// --- 前台首页 ---

const INITIAL_LOAD_COUNT = 32; // 初始加载数量
const LOAD_MORE_COUNT = 20;    // 每次加载更多数量

const PublicHome: React.FC<{ data: PublicData }> = ({ data }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, order: SortOrder }>({ key: 'createdAt', order: 'desc' });
  
  // 状态：搜索词 (从 URL 初始化，以支持返回保留结果)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  
  // 状态：当前可见的卡片数量
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  // 状态：标签
  const activeTag = searchParams.get('tag') || 'all';

  // --- Hero 轮播逻辑 ---
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  // 触摸滑动逻辑
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
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) {
       setHeroIndex(prev => (prev + 1) % heroCards.length);
    }
    if (isRightSwipe) {
       setHeroIndex(prev => (prev - 1 + heroCards.length) % heroCards.length);
    }
  };

  // 获取推荐卡片用于轮播
  const heroCards = useMemo(() => {
    const recommended = data.cards.filter(c => c.isRecommended);
    const shuffled = [...recommended].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [data.cards]);
  
  const showHero = activeTag === 'all' && !searchTerm && heroCards.length > 0;

  // 轮播定时器
  useEffect(() => {
    if (!showHero || isHeroPaused || heroCards.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroCards.length);
    }, 4000); 
    return () => clearInterval(timer);
  }, [showHero, isHeroPaused, heroCards.length]);

  // 当筛选条件改变时，重置显示数量，但如果是初始化加载（比如返回时），不需要重置过度
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD_COUNT);
    setHeroIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTag, sortConfig]); // 移除 searchTerm 依赖，防止输入时频繁跳动

  // Intersection Observer 监听底部 (触底自动加载)
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + LOAD_MORE_COUNT);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, []);

  // 处理标签切换 (同时保留搜索参数)
  const handleTagChange = (tagId: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tag', tagId);
      return newParams;
    });
  };

  // 处理搜索 (同步到 URL)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (val) newParams.set('q', val);
      else newParams.delete('q');
      return newParams;
    }, { replace: true }); // 使用 replace 避免输入时产生大量历史记录
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('q');
      return newParams;
    });
  };

  const filteredCards = useMemo(() => {
    let list = [...data.cards];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(term) || c.description.toLowerCase().includes(term));
    }
    if (activeTag === 'recommended') {
      list = list.filter(c => c.isRecommended);
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

  return (
    <div className="min-h-screen bg-[#f8f8f7] flex flex-col lg:flex-row font-sans selection:bg-ink selection:text-white">
      {/* 桌面端侧边导航 (移动端隐藏) */}
      <aside className="hidden lg:flex lg:w-64 lg:h-screen lg:sticky lg:top-0 bg-white border-r border-stone-200 p-8 flex-col z-40">
        <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={() => window.location.href = '/'}>
          <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
          <h1 className="font-bold text-lg text-ink tracking-tight">{data.settings.title}</h1>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1">
          <button 
            onClick={() => handleTagChange('all')}
            className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all ${activeTag === 'all' ? 'bg-ink text-white shadow-md' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={14} />
              <span className="text-sm font-semibold">全部展示</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">{data.cards.length}</span>
          </button>

          <button 
            onClick={() => handleTagChange('recommended')}
            className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all mt-1 ${activeTag === 'recommended' ? 'bg-amber-500 text-white shadow-md' : 'text-amber-600 hover:bg-amber-50'}`}
          >
            <div className="flex items-center gap-2">
              <ThumbsUp size={14} />
              <span className="text-sm font-semibold">精选推荐</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">{data.cards.filter(c => c.isRecommended).length}</span>
          </button>
          
          <div className="h-px bg-stone-100 my-4 mx-4" />
          
          {data.tags.map(tag => {
            const count = data.cards.filter(c => c.tagIds.includes(tag.id)).length;
            return (
              <button 
                key={tag.id}
                onClick={() => handleTagChange(tag.id)}
                className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all ${activeTag === tag.id ? 'bg-ink text-white shadow-md' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
              >
                <span className="text-sm font-semibold">{tag.name}</span>
                <span className="text-[10px] font-mono opacity-60">{count}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-x-hidden flex flex-col">
        {/* 移动端专属头部 (Logo + 横向滚动标签) */}
        <div className="lg:hidden flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3" onClick={() => window.location.href = '/'}>
            <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
            <h1 className="font-bold text-lg text-ink tracking-tight">{data.settings.title}</h1>
          </div>
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2 mask-linear-fade">
             <button 
                onClick={() => handleTagChange('all')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'all' ? 'bg-ink text-white shadow-md' : 'bg-white border border-stone-200 text-subtle'}`}
              >
                <LayoutGrid size={12} /> 全部
             </button>
             <button 
                onClick={() => handleTagChange('recommended')}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center gap-2 ${activeTag === 'recommended' ? 'bg-amber-500 text-white shadow-md' : 'bg-white border border-stone-200 text-amber-600'}`}
              >
                <ThumbsUp size={12} /> 推荐
             </button>
             {data.tags.map(tag => (
                <button 
                  key={tag.id}
                  onClick={() => handleTagChange(tag.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${activeTag === tag.id ? 'bg-ink text-white shadow-md' : 'bg-white border border-stone-200 text-subtle'}`}
                >
                  {tag.name}
                </button>
             ))}
          </div>
        </div>

        {/* 顶部工具栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
           <div className="relative w-full sm:max-w-xs group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-ink transition-colors" size={16} />
             <input 
               type="text"
               placeholder="搜你想看..."
               value={searchTerm}
               onChange={handleSearchChange}
               className="w-full bg-white border border-stone-200 rounded-2xl py-3 pl-12 pr-10 text-sm font-bold focus:outline-none focus:border-ink focus:ring-8 focus:ring-stone-200/50 transition-all"
             />
             {searchTerm && <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink"><X size={16} /></button>}
           </div>
           
           <div className="flex items-center gap-2">
             <div className="flex bg-stone-100 p-1.5 rounded-xl">
               {(['createdAt', 'rating', 'updatedAt'] as SortKey[]).map(key => (
                 <button
                   key={key}
                   onClick={() => setSortConfig(prev => ({ key, order: prev.key === key ? (prev.order === 'desc' ? 'asc' : 'desc') : 'desc' }))}
                   className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${sortConfig.key === key ? 'bg-white text-ink shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                 >
                   {key === 'createdAt' ? '创建' : key === 'rating' ? '评分' : '更新'}
                   {sortConfig.key === key && <ArrowUpDown size={10} className={sortConfig.order === 'asc' ? 'rotate-180 transition-transform' : ''} />}
                 </button>
               ))}
             </div>
           </div>
        </div>

        {filteredCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-32 opacity-20"><Grid size={64} className="mb-4 stroke-[1]" /><p className="font-bold uppercase tracking-widest">NO DATA</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 auto-rows-min">
            
            {/* --- Hero Carousel (优化版：淡入淡出堆叠 + 触摸滑动) --- */}
            {showHero && heroCards.length > 0 && (
              <div 
                className="group relative sm:col-span-2 sm:row-span-2 aspect-video rounded-2xl shadow-[0_0_15px_rgba(251,191,36,0.6)] ring-1 ring-amber-400 w-full overflow-hidden isolate touch-pan-y"
                onMouseEnter={() => setIsHeroPaused(true)}
                onMouseLeave={() => setIsHeroPaused(false)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
              >
                {/* 渲染所有幻灯片，通过透明度切换 */}
                {heroCards.map((card, idx) => (
                  <Link 
                    key={card.id} 
                    to={`/card/${card.id}`} 
                    className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${idx === heroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                    draggable={false}
                  >
                    <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full object-cover select-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                    
                    <div className="absolute top-0 left-0 bg-amber-400 text-white p-2.5 rounded-br-2xl shadow-lg z-10">
                      <ThumbsUp size={24} />
                    </div>

                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-black text-ink">{card.rating.toFixed(1)}</span>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white drop-shadow-md z-20">
                      <h3 className="text-2xl sm:text-3xl font-black leading-tight line-clamp-2 mb-2">{card.title}</h3>
                      <p className="text-white/90 text-sm line-clamp-2 font-medium">{card.description}</p>
                    </div>
                  </Link>
                ))}

                {/* 轮播控制 (移动端纯箭头，桌面端带背景) */}
                {heroCards.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex(prev => (prev - 1 + heroCards.length) % heroCards.length); }}
                      className="absolute left+4 top-1/2 -translate-y-1/2 p-2 text-white z-30 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:bg-black/20 lg:hover:bg-black/40 lg:backdrop-blur-sm lg:rounded-full drop-shadow-md lg:left-2"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex(prev => (prev + 1) % heroCards.length); }}
                      className="absolute right+4 top-1/2 -translate-y-1/2 p-2 text-white z-30 transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:bg-black/20 lg:hover:bg-black/40 lg:backdrop-blur-sm lg:rounded-full drop-shadow-md lg:right-2"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                       {heroCards.map((_, idx) => (
                         <div 
                           key={idx} 
                           className={`h-1 rounded-full transition-all duration-300 ${idx === heroIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} 
                         />
                       ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- 普通卡片网格 --- */}
            {filteredCards.slice(0, visibleCount).map((card, idx) => (
              <Link 
                to={`/card/${card.id}`}
                key={card.id} 
                className="group cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${(idx % 10) * 40}ms` }}
              >
                <div className={`relative rounded-2xl transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 h-full w-full aspect-video ${card.isRecommended ? 'shadow-[0_0_15px_rgba(251,191,36,0.6)] ring-1 ring-amber-400' : 'bg-stone-200 shadow-sm'}`}>
                  
                  <div className="w-full h-full rounded-2xl overflow-hidden relative isolate" style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                    <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full transition-transform duration-1000 group-hover:scale-110" />
                    
                    <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    
                    {card.isRecommended && (
                      <div className="absolute top-0 left-0 bg-amber-400 text-white p-2.5 rounded-br-2xl shadow-lg z-10">
                        <ThumbsUp size={16} />
                      </div>
                    )}

                    <div className="absolute top-3 right-3 flex gap-2">
                        <div className="bg-white/95 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5">
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs font-black text-ink">{card.rating.toFixed(1)}</span>
                        </div>
                    </div>
                    
                    <div className="absolute bottom-0 left-0 right-0 text-white drop-shadow-md flex flex-col justify-end p-4">
                      <h3 className="text-lg font-black leading-tight line-clamp-2 origin-bottom-left transition-transform duration-300">{card.title}</h3>
                      <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-500 ease-out">
                         <div className="overflow-hidden">
                            <p className="text-white/90 pt-2 line-clamp-2 font-medium text-[10px]">{card.description}</p>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 底部自动加载触发器 (纯自动) */}
        {visibleCount < filteredCards.length ? (
          <div 
            ref={observerTarget} 
            className="flex justify-center mt-16 pb-8 min-h-[50px]" 
          >
            <div className="animate-pulse flex items-center gap-2 text-stone-300 text-xs font-bold uppercase tracking-widest">
               <Loader2 className="animate-spin" size={14} />
               <span>Loading more</span>
            </div>
          </div>
        ) : (
          filteredCards.length > 0 && (
            <div className="text-center mt-16 pb-8 text-xs font-bold text-stone-300 uppercase tracking-widest">
              — End of Collection —
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default App;