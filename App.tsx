import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, Link } from 'react-router-dom';
import { LayoutGrid, Search, X, ChevronLeft, ChevronRight, ChevronDown, ThumbsUp, ArrowUpDown, Star, Grid } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // 状态：当前可见的卡片数量
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  // 状态：是否已经暂停过一次自动加载
  const [firstScrollPaused, setFirstScrollPaused] = useState(false);
  
  // 使用 Ref 来跟踪是否需要暂停，避免 Effect 重新绑定导致的无限加载
  const shouldPauseRef = useRef(true);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  // 状态：标签
  const activeTag = searchParams.get('tag') || 'all';

  // --- Hero 轮播逻辑 ---
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false); // 鼠标悬停时暂停

  // 获取推荐卡片用于轮播：随机打乱并取前10个
  const heroCards = useMemo(() => {
    const recommended = data.cards.filter(c => c.isRecommended);
    const shuffled = [...recommended].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [data.cards]);
  
  // 是否显示 Hero 区域：仅在“全部展示”且无搜索词且有推荐卡片时显示
  const showHero = activeTag === 'all' && !searchTerm && heroCards.length > 0;

  // 轮播定时器
  useEffect(() => {
    if (!showHero || isHeroPaused || heroCards.length <= 1) return;
    
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroCards.length);
    }, 4000); // 4秒切换

    return () => clearInterval(timer);
  }, [showHero, isHeroPaused, heroCards.length]);

  // 当筛选条件改变时，重置滚动暂停状态和可见数量
  useEffect(() => {
    setFirstScrollPaused(false);
    shouldPauseRef.current = true;
    setVisibleCount(INITIAL_LOAD_COUNT);
    setHeroIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTag, searchTerm, sortConfig]);

  // 监听底部实现加载逻辑
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          // 使用 Ref 进行判断，不依赖 state，防止 Observer 重建
          if (shouldPauseRef.current) {
            shouldPauseRef.current = false;
            setFirstScrollPaused(true); // 触发 UI 更新显示文本
          } else {
            // 第二次进入（或状态已变更），执行加载
            setVisibleCount(prev => prev + LOAD_MORE_COUNT);
          }
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, []); // 依赖项为空，确保 Observer 实例稳定

  // 处理标签切换
  const handleTagChange = (tagId: string) => {
    setSearchParams({ tag: tagId });
    // 其他重置逻辑已由上面的 useEffect 处理
  };

  const filteredCards = useMemo(() => {
    let list = [...data.cards];
    
    // 1. 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(term) || c.description.toLowerCase().includes(term));
    }
    
    // 2. 标签过滤
    if (activeTag === 'recommended') {
      list = list.filter(c => c.isRecommended);
    } else if (activeTag !== 'all') {
      list = list.filter(c => c.tagIds.includes(activeTag));
    }
    
    // 3. 排序
    list.sort((a, b) => {
      const valA = a[sortConfig.key] || 0;
      const valB = b[sortConfig.key] || 0;
      return sortConfig.order === 'desc' ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
    });

    return list;
  }, [data.cards, activeTag, sortConfig, searchTerm]);

  // 当前轮播显示的卡片
  const currentHeroCard = heroCards[heroIndex];

  return (
    <div className="min-h-screen bg-[#f8f8f7] flex flex-col lg:flex-row font-sans selection:bg-ink selection:text-white">
      {/* 侧边导航 */}
      <aside className="lg:w-64 lg:h-screen lg:sticky lg:top-0 bg-white border-r border-stone-200 p-8 flex flex-col z-40">
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
        {/* 顶部工具栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
           <div className="relative w-full sm:max-w-xs group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-ink transition-colors" size={16} />
             <input 
               type="text"
               placeholder="搜你想看..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full bg-white border border-stone-200 rounded-2xl py-3 pl-12 pr-10 text-sm font-bold focus:outline-none focus:border-ink focus:ring-8 focus:ring-stone-200/50 transition-all"
             />
             {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink"><X size={16} /></button>}
           </div>
           
           <div className="flex items-center gap-2 self-end">
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
            
            {/* --- Hero Carousel --- */}
            {showHero && currentHeroCard && (
              <div 
                className="group relative sm:col-span-2 sm:row-span-2 aspect-video rounded-2xl shadow-[0_0_15px_rgba(251,191,36,0.6)] ring-1 ring-amber-400 w-full overflow-hidden isolate"
                onMouseEnter={() => setIsHeroPaused(true)}
                onMouseLeave={() => setIsHeroPaused(false)}
                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
              >
                <Link to={`/card/${currentHeroCard.id}`} className="block w-full h-full">
                   <div key={currentHeroCard.id} className="w-full h-full animate-in fade-in duration-700">
                     <ImagePreview src={currentHeroCard.coverUrl} alt={currentHeroCard.title} className="w-full h-full object-cover transition-transform duration-[4000ms] ease-linear scale-100 group-hover:scale-105" />
                   </div>
                   
                   <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                   
                   <div className="absolute top-0 left-0 bg-amber-400 text-white p-2.5 rounded-br-2xl shadow-lg z-10">
                     <ThumbsUp size={24} />
                   </div>

                   <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5">
                     <Star size={12} className="text-amber-400 fill-amber-400" />
                     <span className="text-xs font-black text-ink">{currentHeroCard.rating.toFixed(1)}</span>
                   </div>

                   <div className="absolute bottom-0 left-0 right-0 p-6 text-white drop-shadow-md z-20">
                     <h3 className="text-2xl sm:text-3xl font-black leading-tight line-clamp-2 mb-2">{currentHeroCard.title}</h3>
                     <p className="text-white/90 text-sm line-clamp-2 font-medium">{currentHeroCard.description}</p>
                   </div>
                </Link>

                {heroCards.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex(prev => (prev - 1 + heroCards.length) % heroCards.length); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHeroIndex(prev => (prev + 1) % heroCards.length); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
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

        {/* 底部自动加载触发器 */}
        {visibleCount < filteredCards.length ? (
          <div ref={observerTarget} className="flex justify-center mt-16 pb-8 min-h-[50px]">
            <div className={`flex items-center gap-2 text-stone-400 text-sm font-bold ${!firstScrollPaused ? 'animate-pulse' : ''}`}>
               <ChevronDown size={16} />
               <span className="uppercase tracking-widest">
                 {firstScrollPaused ? '再次滑动加载更多' : '下拉加载更多'}
               </span>
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