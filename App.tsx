import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Calendar, Loader2, CloudUpload, AlertCircle, RefreshCw, Search, X, ChevronLeft, ChevronRight, ChevronDown, ThumbsUp, ArrowUpDown, ArrowLeft, Clock, Star, LayoutGrid, Menu, Home, Play, Pause } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA } from './services/webdavService';
import { PublicData, CardData } from './types';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating, TextArea, AdminCard, ToastProvider, useToast, ConfirmModal, MultiSelect } from './components/Common';
import { PublicDetail } from './components/PublicDetail';

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
  
  // 状态：当前可见的卡片数量（替代分页）
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 状态：标签
  const activeTag = searchParams.get('tag') || 'all';

  // --- Hero 轮播逻辑 ---
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false); // 鼠标悬停时暂停

  // 获取推荐卡片用于轮播：随机打乱并取前10个
  const heroCards = useMemo(() => {
    const recommended = data.cards.filter(c => c.isRecommended);
    // Fisher-Yates shuffle algorithm equivalent for concise randomness
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

  // 监听底部实现自动加载
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
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget]);

  // 处理标签切换
  const handleTagChange = (tagId: string) => {
    setSearchParams({ tag: tagId });
    setVisibleCount(INITIAL_LOAD_COUNT); // 重置可见数量
    setHeroIndex(0); // 重置轮播
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            
            {/* --- Hero Carousel (占用前 2x2 格子) --- */}
            {showHero && currentHeroCard && (
              <div 
                className="group relative sm:col-span-2 sm:row-span-2 aspect-video rounded-2xl shadow-[0_0_15px_rgba(251,191,36,0.6)] ring-1 ring-amber-400 w-full overflow-hidden isolate"
                onMouseEnter={() => setIsHeroPaused(true)}
                onMouseLeave={() => setIsHeroPaused(false)}
                style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
              >
                <Link to={`/card/${currentHeroCard.id}`} className="block w-full h-full">
                   {/* 背景图，添加淡入淡出动画 key 以触发重绘 */}
                   <div key={currentHeroCard.id} className="w-full h-full animate-in fade-in duration-700">
                     <ImagePreview src={currentHeroCard.coverUrl} alt={currentHeroCard.title} className="w-full h-full object-cover transition-transform duration-[4000ms] ease-linear scale-100 group-hover:scale-105" />
                   </div>
                   
                   {/* 渐变遮罩 */}
                   <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                   
                   {/* 推荐标签 */}
                   <div className="absolute top-0 left-0 bg-amber-400 text-white p-2.5 rounded-br-2xl shadow-lg z-10">
                     <ThumbsUp size={24} />
                   </div>

                   {/* 评分 */}
                   <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center shadow-sm gap-1.5">
                     <Star size={12} className="text-amber-400 fill-amber-400" />
                     <span className="text-xs font-black text-ink">{currentHeroCard.rating.toFixed(1)}</span>
                   </div>

                   {/* 内容信息 */}
                   <div className="absolute bottom-0 left-0 right-0 p-6 text-white drop-shadow-md z-20">
                     <h3 className="text-2xl sm:text-3xl font-black leading-tight line-clamp-2 mb-2">{currentHeroCard.title}</h3>
                     <p className="text-white/90 text-sm line-clamp-2 font-medium">{currentHeroCard.description}</p>
                   </div>
                </Link>

                {/* 轮播控制 (仅当有多于一张推荐卡片时显示) */}
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
                    {/* 进度指示点 */}
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

            {/* --- 普通卡片网格 (显示所有筛选后的卡片，确保排序稳定) --- */}
            {filteredCards.slice(0, visibleCount).map((card, idx) => (
              <Link 
                to={`/card/${card.id}`}
                key={card.id} 
                className="group cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${(idx % 10) * 40}ms` }}
              >
                <div className={`relative rounded-2xl transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 h-full w-full aspect-video ${card.isRecommended ? 'shadow-[0_0_15px_rgba(251,191,36,0.6)] ring-1 ring-amber-400' : 'bg-stone-200 shadow-sm'}`}>
                  
                  {/* 内部容器：应用遮罩 */}
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
          <div ref={observerTarget} className="flex justify-center mt-16 pb-8">
            <div className="flex items-center gap-2 text-stone-400 text-sm font-bold animate-pulse">
               <ChevronDown size={16} />
               <span className="uppercase tracking-widest">下拉加载更多</span>
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

// --- 管理后台 (App.tsx 的其余部分保持不变) ---
// AdminLayout, AdminLogin, AdminCards, AdminTags, AdminSettings 组件保持不变

const AdminLayout: React.FC<{ initialData: PublicData; refreshData: () => Promise<void> }> = ({ initialData, refreshData }) => {
  const [localData, setLocalData] = useState<PublicData>(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // 移动端菜单状态
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const expiry = localStorage.getItem('tat_expiry');
    if (expiry && new Date().getTime() < parseInt(expiry)) setIsAuth(true);
    setChecking(false);
  }, []);

  const handleDataChange = (newData: PublicData) => {
    setLocalData(newData);
    setHasChanges(true);
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await webdav.savePublicData(localData);
    if (result.success) {
      await refreshData();
      setHasChanges(false);
      showToast('数据同步成功', 'success');
    } else {
      showToast(`同步失败: ${result.error}`, 'error');
    }
    setSyncing(false);
  };

  if (checking) return <PageLoader />;
  if (!isAuth) return <AdminLogin onLogin={(keep) => {
    setIsAuth(true);
    localStorage.setItem('tat_expiry', (new Date().getTime() + (keep ? 30 : 1) * 24 * 60 * 60 * 1000).toString());
  }} />;

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden font-sans">
      {/* 移动端侧边栏遮罩 */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* 侧边栏：移动端支持滑出 */}
      <aside className={`w-64 bg-white border-r border-stone-200 flex flex-col z-40 fixed inset-y-0 left-0 transform transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-20 border-b border-stone-100 flex items-center px-8 gap-4 justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-white"><Layout size={18} /></div>
            <span className="font-bold text-ink text-lg">后台管理</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-stone-400 hover:text-ink"><X size={20} /></button>
        </div>
        <div className="p-6 flex-1">
           <nav className="space-y-2">
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/cards" icon={<Grid size={18} />} label="卡片管理" count={localData.cards.length} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/tags" icon={<Tags size={18} />} label="分类管理" count={localData.tags.length} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/settings" icon={<Settings size={18} />} label="网站设置" /></div>
           </nav>
        </div>
        <div className="p-6 border-t border-stone-100 flex flex-col gap-2">
          <div onClick={() => { window.location.href = '/'; }}><NavButton to="/" icon={<Home size={18} />} label="返回首页" /></div>
          <button onClick={() => { localStorage.removeItem('tat_expiry'); window.location.href = '/'; }} className="flex items-center gap-3 px-4 py-3 w-full text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"><LogOut size={16} /><span>退出登录</span></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-stone-100 h-20 flex items-center justify-between px-6 sm:px-8 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            {/* 移动端菜单按钮 */}
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-stone-500 hover:bg-stone-100 rounded-lg"><Menu size={20} /></button>
            <h2 className="text-lg font-bold text-ink">
              {location.pathname.includes('cards') ? '卡片档案' : 
               location.pathname.includes('tags') ? '分类配置' : '系统参数'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {hasChanges && <div className="hidden sm:flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg text-xs font-bold border border-amber-100"><AlertCircle size={14} /><span>有待同步的修改</span></div>}
            <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" size="md" className="rounded-xl h-10 px-5">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              <span>{syncing ? '同步中' : '同步云端'}</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10"><div className="max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="cards" element={<AdminCards data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="tags" element={<AdminTags data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="settings" element={<AdminSettings data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="*" element={<Navigate to="cards" replace />} />
            </Routes>
          </div></main>
      </div>
    </div>
  );
};

// ... NavButton, AdminLogin, AdminCards, AdminTags, AdminSettings components remain the same ...
const NavButton: React.FC<{ to: string, icon: React.ReactNode, label: string, count?: number }> = ({ to, icon, label, count }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to) && to !== '/'; // Home link shouldn't be active in admin
  return (
    <button onClick={() => navigate(to)} className={`flex items-center justify-between px-4 py-3 w-full text-base font-bold rounded-xl transition-all ${isActive ? 'bg-ink text-white shadow-md' : 'text-stone-500 hover:bg-stone-50 hover:text-ink'}`}>
      <div className="flex items-center gap-3">{icon}<span>{label}</span></div>
      {count !== undefined && <span className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-400'}`}>{count}</span>}
    </button>
  );
}

const AdminLogin: React.FC<{ onLogin: (keep: boolean) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const secrets = await webdav.getPrivateData();
      if (username === secrets.username && password === secrets.password) onLogin(keep);
      else setError('账号或密码错误');
    } catch (err) { setError('连接失败，请检查配置'); } finally { setLoading(false); }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-stone-100 p-12">
        <h2 className="text-2xl font-bold text-center text-ink mb-10">后台管理登录</h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          <Input label="账号" value={username} onChange={e => setUsername(e.target.value)} className="h-12 text-base" />
          <Input label="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 text-base" />
          <div className="flex items-center gap-2 px-1"><input type="checkbox" id="keep" checked={keep} onChange={e => setKeep(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-ink focus:ring-ink" /><label htmlFor="keep" className="text-sm font-bold text-stone-500 cursor-pointer">保持登录</label></div>
          {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100">{error}</div>}
          <Button type="submit" className="w-full h-14 rounded-2xl text-lg" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : '登录系统'}</Button>
        </form>
      </div>
    </div>
  );
};

const AdminCards: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<CardData>>({});
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 22;

  const filtered = useMemo(() => data.cards.filter(c => c.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [data.cards, search]);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedCards = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSave = () => {
    const newCards = [...data.cards];
    const now = Date.now();
    if (editingCard.id) {
      const idx = newCards.findIndex(c => c.id === editingCard.id);
      if (idx !== -1) newCards[idx] = { ...editingCard, updatedAt: now } as CardData;
    } else {
      newCards.push({ ...editingCard, id: now.toString(), createdAt: now, updatedAt: now } as CardData);
    }
    onUpdate({ ...data, cards: newCards });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative max-w-sm w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} /><input placeholder="搜索记录..." className="w-full pl-11 pr-10 py-3 bg-white border border-stone-200 rounded-xl text-sm font-bold focus:outline-none focus:border-ink transition-all" value={search} onChange={e => setSearch(e.target.value)} />{search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink"><X size={16} /></button>}</div>
        <Button onClick={() => { setEditingCard({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false }); setIsModalOpen(true); }} size="md" className="rounded-xl h-11 px-6"><Plus size={18} /> 新建记录</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {paginatedCards.map(card => (
          <div key={card.id} className={`bg-white rounded-2xl border overflow-hidden group flex flex-col h-full hover:border-stone-400 transition-colors shadow-sm ${card.isRecommended ? 'border-amber-200 ring-4 ring-amber-50' : 'border-stone-200'}`}>
            <div className="aspect-[21/9] bg-stone-50 overflow-hidden relative">
              <ImagePreview src={card.coverUrl} alt={card.title} />
              <div className="absolute inset-0 bg-ink/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-3 bg-white text-ink rounded-xl shadow-lg hover:bg-ink hover:text-white transition-all"><Edit2 size={18} /></button>
                <button onClick={() => setDeleteId(card.id)} className="p-3 bg-white text-red-500 rounded-xl shadow-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
              </div>
              {card.isRecommended && <div className="absolute top-3 left-3 bg-amber-400 text-white p-1.5 rounded-lg shadow-md"><ThumbsUp size={14} /></div>}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h4 className="font-bold text-ink text-sm truncate mb-2">{card.title}</h4>
              <div className="mt-auto flex items-center gap-2 text-xs text-stone-400">
                 <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded font-bold uppercase tracking-wide scale-90 origin-left">{data.tags.find(t=>t.id===card.tagIds[0])?.name || '未分类'}</span>
                 <Rating value={card.rating} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="secondary" size="sm" className="px-3"><ChevronLeft size={16} /></Button>
          <span className="text-sm font-bold text-stone-400">Page {currentPage} of {totalPages}</span>
          <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="secondary" size="sm" className="px-3"><ChevronRight size={16} /></Button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCard.id ? "编辑记录" : "新建记录"}>
        <div className="space-y-8">
          <Input label="标题" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} className="h-11 text-base" />
          
          <div className="flex items-end gap-6">
            <div className="flex-1"><MultiSelect label="分类" options={data.tags} value={editingCard.tagIds || []} onChange={ids => setEditingCard({...editingCard, tagIds: ids})} /></div>
            <div className="flex flex-col items-center gap-2 pb-1">
              <label className="text-xs font-bold text-stone-400 uppercase">推荐</label>
              <input type="checkbox" checked={!!editingCard.isRecommended} onChange={e => setEditingCard({...editingCard, isRecommended: e.target.checked})} className="w-6 h-6 rounded border-stone-300 text-amber-500 focus:ring-amber-400" />
            </div>
          </div>

          <div className="flex gap-6">
             <div className="w-28 h-28 bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 flex-shrink-0"><ImagePreview src={editingCard.coverUrl || ''} alt="Preview" className="h-full w-full" /></div>
             <div className="flex-1 space-y-5">
               <Input label="封面链接 (URL)" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} className="h-11" />
               <div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-stone-400 uppercase">评分</label><input type="range" min="0" max="5" step="0.5" className="flex-1 accent-ink h-2 bg-stone-100 rounded-lg appearance-none" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} /><span className="text-sm font-bold text-ink w-8">{editingCard.rating}</span></div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <Input label="开始日期" type="date" max="9999-12-31" value={editingCard.startDate || ''} onChange={e => { const val = e.target.value; if (val.split('-')[0].length <= 4) setEditingCard({...editingCard, startDate: val}); }} className="h-11" />
            <Input label="结束日期" type="date" max="9999-12-31" value={editingCard.endDate || ''} onChange={e => { const val = e.target.value; if (val.split('-')[0].length <= 4) setEditingCard({...editingCard, endDate: val}); }} className="h-11" />
          </div>

          <TextArea label="详细描述" value={editingCard.description || ''} onChange={e => setEditingCard({...editingCard, description: e.target.value})} className="min-h-[120px] text-base" />
          <Button onClick={handleSave} className="w-full h-14 rounded-2xl text-base">确认保存</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => onUpdate({ ...data, cards: data.cards.filter(c => c.id !== deleteId) })} title="删除确认" message="确定要永久移除此记录吗？" confirmText="删除" type="danger" />
    </div>
  );
};


const AdminTags: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [newTag, setNewTag] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  return (
    <div className="space-y-10 max-w-4xl">
      <AdminCard title="新建分类"><div className="flex gap-4"><Input placeholder="输入名称..." value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-1 h-12 text-base" /><Button onClick={() => { onUpdate({...data, tags: [...data.tags, {id: Date.now().toString(), name: newTag}]}); setNewTag(''); }} disabled={!newTag.trim()} className="w-12 h-12 p-0 rounded-xl"><Plus size={24} /></Button></div></AdminCard>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {data.tags.map(tag => (
          <div key={tag.id} className="bg-white p-5 rounded-2xl border border-stone-200 flex items-center justify-between group shadow-sm hover:border-stone-400 transition-colors">
            <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center text-stone-400 font-bold text-xs uppercase border border-stone-100">{tag.name.substring(0,1)}</div><span className="font-bold text-ink text-base">{tag.name}</span></div>
            <button onClick={() => setDeleteId(tag.id)} className="p-3 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => onUpdate({...data, tags: data.tags.filter(t=>t.id!==deleteId)})} title="删除分类" message="此操作不可撤销。" confirmText="删除" type="danger" />
    </div>
  );
};

const AdminSettings: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const { showToast } = useToast();
  useEffect(() => { webdav.getPrivateData().then(setCreds); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
      <div className="lg:col-span-2 space-y-10">
        <AdminCard title="网站设置"><div className="space-y-8"><Input label="网站标题" value={siteSettings.title} onChange={e => { const s = {...siteSettings, title: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} className="h-12 text-base" /><Input label="图标 (URL)" value={siteSettings.iconUrl} onChange={e => { const s = {...siteSettings, iconUrl: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} className="h-12 text-base" /></div></AdminCard>
      </div>
      <AdminCard title="安全选项"><div className="space-y-6"><Input label="账号" value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} className="h-12 text-base" /><Input label="密码" type="password" value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} className="h-12 text-base" /><Button className="w-full h-12 rounded-xl text-base" onClick={async () => { const res = await webdav.savePrivateData(creds); if(res.success) showToast('已保存'); else showToast('失败','error'); }}>保存安全配置</Button></div></AdminCard>
    </div>
  );
};

export default App;
