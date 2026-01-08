import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Calendar, Lock, Loader2, CloudUpload, AlertCircle, RefreshCw, Check, Search, ExternalLink, X, ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA, testConnection } from './services/webdavService';
import { PublicData, CardData, Tag } from './types';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating, TextArea, AdminCard, ToastProvider, useToast, ConfirmModal, MultiSelect } from './components/Common';

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
        <Route path="/tat/*" element={<AdminLayout initialData={data} refreshData={fetchData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// --- 前台首页 (精制画廊风) ---

const PublicHome: React.FC<{ data: PublicData }> = ({ data }) => {
  const [activeTag, setActiveTag] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  const filteredCards = useMemo(() => activeTag === 'all' 
    ? data.cards 
    : data.cards.filter(c => c.tagIds.includes(activeTag)), [data.cards, activeTag]);

  const getYear = (dateStr?: string) => {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return '';
    return dateStr.split('-')[0];
  };

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
            onClick={() => setActiveTag('all')}
            className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all ${activeTag === 'all' ? 'bg-ink text-white shadow-md' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
          >
            <span className="text-sm font-semibold">全部展示</span>
            <span className="text-[10px] font-mono opacity-60">{data.cards.length}</span>
          </button>
          
          <div className="h-px bg-stone-100 my-4 mx-4" />
          
          {data.tags.map(tag => {
            const count = data.cards.filter(c => c.tagIds.includes(tag.id)).length;
            return (
              <button 
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                className={`flex items-center justify-between py-2.5 px-4 rounded-xl transition-all ${activeTag === tag.id ? 'bg-ink text-white shadow-md' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
              >
                <span className="text-sm font-semibold">{tag.name}</span>
                <span className="text-[10px] font-mono opacity-60">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 pt-8 border-t border-stone-100">
           <p className="text-[11px] text-stone-400 leading-relaxed italic">珍藏生活的每一处细节。</p>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-x-hidden">
        {filteredCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-32 opacity-20">
            <Grid className="w-16 h-16 mb-4 stroke-[1]" />
            <p className="text-sm font-medium tracking-widest">暂无收藏内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
            {filteredCards.map((card, idx) => (
              <div 
                key={card.id} 
                onClick={() => setSelectedCard(card)} 
                className="group cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="relative overflow-hidden rounded-2xl bg-stone-200 aspect-video shadow-sm transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-1.5 border border-stone-100">
                   <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full transition-transform duration-700 group-hover:scale-105" />
                   
                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                   
                   {/* 悬浮标签 */}
                   <div className="absolute top-4 left-4">
                      <div className="bg-white/90 backdrop-blur border border-white/20 px-2.5 py-1 rounded-lg flex items-center gap-2 shadow-sm">
                         <span className="text-[10px] font-bold text-ink uppercase">{getYear(card.startDate) || '收藏'}</span>
                      </div>
                   </div>
                </div>
                
                <div className="mt-4 px-1">
                   <h3 className="font-bold text-ink text-base truncate mb-1 group-hover:text-blue-600 transition-colors">{card.title}</h3>
                   <div className="flex items-center gap-3">
                      <Rating value={card.rating} />
                      <span className="text-[10px] text-stone-400 font-medium">{data.tags.find(t => t.id === card.tagIds[0])?.name || '未分类'}</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 详情弹窗 */}
      <Modal isOpen={!!selectedCard} onClose={() => setSelectedCard(null)} title={selectedCard?.title || ''}>
        {selectedCard && (
          <div className="space-y-8">
            <div className="aspect-video rounded-xl overflow-hidden border border-stone-200 shadow-lg"><ImagePreview src={selectedCard.coverUrl} alt={selectedCard.title} /></div>
            
            <div className="flex flex-col md:flex-row gap-8">
               <div className="flex-1 space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">描述详情</label>
                    <div className="text-base text-ink leading-relaxed whitespace-pre-wrap">
                      {selectedCard.description || <span className="text-stone-300 italic">暂无详细描述信息。</span>}
                    </div>
                  </div>
               </div>

               <div className="md:w-48 space-y-6 flex-shrink-0">
                  <div className="bg-stone-50 p-5 rounded-xl border border-stone-100">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">时间线</label>
                    <div className="text-xs font-bold text-ink">{selectedCard.startDate || '-'} 至 {selectedCard.endDate || '至今'}</div>
                  </div>

                  <div className="bg-stone-50 p-5 rounded-xl border border-stone-100">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">个人评分</label>
                    <div className="flex items-center justify-between">
                       <Rating value={selectedCard.rating} />
                       <span className="text-ink font-bold text-sm">{selectedCard.rating}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedCard.tagIds.map(tid => (
                      <span key={tid} className="px-3 py-1 bg-white border border-stone-100 text-stone-500 text-[10px] font-bold rounded-lg uppercase">
                        {data.tags.find(t => t.id === tid)?.name}
                      </span>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// --- 管理后台 ---

const AdminLayout: React.FC<{ initialData: PublicData; refreshData: () => Promise<void> }> = ({ initialData, refreshData }) => {
  const [localData, setLocalData] = useState<PublicData>(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col hidden md:flex z-20">
        <div className="h-16 border-b border-stone-100 flex items-center px-6 gap-3">
          <div className="w-6 h-6 bg-ink rounded flex items-center justify-center text-white"><Layout size={14} /></div>
          <span className="font-bold text-ink text-sm">后台管理</span>
        </div>
        <div className="p-4 flex-1">
           <nav className="space-y-1">
             <NavButton to="/tat/cards" icon={<Grid size={16} />} label="卡片管理" count={localData.cards.length} />
             <NavButton to="/tat/tags" icon={<Tags size={16} />} label="分类管理" count={localData.tags.length} />
             <NavButton to="/tat/settings" icon={<Settings size={16} />} label="网站设置" />
           </nav>
        </div>
        <div className="p-4 border-t border-stone-100">
          <button onClick={() => { localStorage.removeItem('tat_expiry'); window.location.href = '/'; }} className="flex items-center gap-3 px-3 py-2 w-full text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all"><LogOut size={14} /><span>退出登录</span></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-stone-100 h-16 flex items-center justify-between px-6 z-10 sticky top-0">
          <h2 className="text-sm font-bold text-ink">
            {location.pathname.includes('cards') ? '卡片档案' : 
             location.pathname.includes('tags') ? '分类配置' : '系统参数'}
          </h2>
          
          <div className="flex items-center gap-4">
            {hasChanges && (
              <div className="hidden sm:flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-amber-100">
                <AlertCircle size={12} />
                <span>有未同步的修改</span>
              </div>
            )}
            <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" size="sm" className="rounded-lg">
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
              <span>{syncing ? '同步中' : '同步云端'}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto w-full">
            <Routes>
              <Route path="cards" element={<AdminCards data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="tags" element={<AdminTags data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="settings" element={<AdminSettings data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="*" element={<Navigate to="cards" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around p-2 pb-safe z-40">
        <NavButtonMobile to="/tat/cards" icon={<Grid size={18} />} label="卡片" />
        <NavButtonMobile to="/tat/tags" icon={<Tags size={18} />} label="分类" />
        <NavButtonMobile to="/tat/settings" icon={<Settings size={18} />} label="设置" />
      </div>
    </div>
  );
};

const NavButton: React.FC<{ to: string, icon: React.ReactNode, label: string, count?: number }> = ({ to, icon, label, count }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to);
  return (
    <button 
      onClick={() => navigate(to)} 
      className={`flex items-center justify-between px-3 py-2 w-full text-xs font-bold rounded-lg transition-all ${isActive ? 'bg-ink text-white shadow-sm' : 'text-stone-500 hover:bg-stone-50 hover:text-ink'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {count !== undefined && <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-400'}`}>{count}</span>}
    </button>
  );
}

const NavButtonMobile: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to);
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center gap-1 p-2 w-full ${isActive ? 'text-ink' : 'text-stone-300'}`}>
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  )
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
    } catch (err) {
      setError('连接失败，请检查配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-stone-100 p-10">
        <div className="flex justify-center mb-8"><div className="p-4 bg-stone-50 rounded-xl"><Lock className="w-8 h-8 text-ink" /></div></div>
        <h2 className="text-xl font-bold text-center text-ink mb-10">后台登录</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input label="账号" value={username} onChange={e => setUsername(e.target.value)} />
          <Input label="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex items-center gap-2 px-1"><input type="checkbox" id="keep" checked={keep} onChange={e => setKeep(e.target.checked)} className="rounded border-stone-300 text-ink focus:ring-ink" /><label htmlFor="keep" className="text-xs font-bold text-stone-400 cursor-pointer">保持登录</label></div>
          {error && <div className="p-3 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
          <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : '登 录'}</Button>
        </form>
      </div>
    </div>
  );
};

// --- 管理模块 ---

const AdminCards: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<CardData>>({});
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = data.cards.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedCards = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [search]);

  const handleSave = () => {
    const newCards = [...data.cards];
    if (editingCard.id) {
      const idx = newCards.findIndex(c => c.id === editingCard.id);
      if (idx !== -1) newCards[idx] = editingCard as CardData;
    } else {
      newCards.push({ ...editingCard, id: Date.now().toString() } as CardData);
    }
    onUpdate({ ...data, cards: newCards });
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) {
      onUpdate({ ...data, cards: data.cards.filter(c => c.id !== deleteId) });
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-xs w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
           <input 
              placeholder="搜索档案..." 
              className="w-full pl-9 pr-9 py-2 bg-white border border-stone-200 rounded-lg text-xs font-bold focus:outline-none focus:border-ink transition-all" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
           />
           {search && (
             <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink"><X size={14} /></button>
           )}
        </div>
        <Button onClick={() => { setEditingCard({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '' }); setIsModalOpen(true); }} size="sm" className="rounded-lg h-9"><Plus size={16} /> 新建记录</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {paginatedCards.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden group flex flex-col h-full hover:border-stone-400 transition-colors">
            <div className="aspect-video bg-stone-50 overflow-hidden relative">
              <ImagePreview src={card.coverUrl} alt={card.title} />
              <div className="absolute inset-0 bg-ink/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-2.5 bg-white text-ink rounded-lg shadow-lg hover:bg-ink hover:text-white transition-all"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteId(card.id)} className="p-2.5 bg-white text-red-500 rounded-lg shadow-lg hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h4 className="font-bold text-ink text-sm truncate mb-1">{card.title}</h4>
              <div className="flex items-center gap-2 mb-3">
                 <Rating value={card.rating} />
                 <span className="text-[10px] font-bold text-stone-300">{card.rating} / 5</span>
              </div>
              <div className="mt-auto pt-3 border-t border-stone-50 flex items-center justify-between">
                 <span className="text-[10px] text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded">{data.tags.find(t=>t.id===card.tagIds[0])?.name || '未分类'}</span>
                 <span className="text-[10px] text-stone-300 font-mono">{(card.startDate || '').split('-')[0] || '-'}</span>
              </div>
            </div>
          </div>
        ))}
        {paginatedCards.length === 0 && (
          <div className="col-span-full py-20 text-center text-stone-300 border-2 border-dashed border-stone-200 rounded-xl">
             <p className="text-sm font-bold">没有找到匹配的记录</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-8">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 rounded-lg border border-stone-200 disabled:opacity-20"><ChevronLeft size={16} /></button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-xs font-bold ${currentPage === page ? 'bg-ink text-white' : 'text-stone-400 hover:bg-stone-50'}`}>{page}</button>
            ))}
          </div>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 rounded-lg border border-stone-200 disabled:opacity-20"><ChevronRight size={16} /></button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCard.id ? "编辑记录" : "新建记录"}>
        <div className="space-y-5">
          <Input label="卡片标题" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} />
          <MultiSelect label="所属分类" options={data.tags} value={editingCard.tagIds || []} onChange={ids => setEditingCard({...editingCard, tagIds: ids})} />

          <div className="flex gap-5">
             <div className="w-24 h-24 bg-stone-50 rounded-lg overflow-hidden border border-stone-200 flex-shrink-0">
               <ImagePreview src={editingCard.coverUrl || ''} alt="Preview" className="h-full w-full" />
             </div>
             <div className="flex-1 space-y-4">
               <Input label="封面链接 (URL)" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} />
               <div className="flex items-center justify-between gap-4">
                  <label className="text-[10px] font-bold text-stone-400 uppercase">评分</label>
                  <input type="range" min="0" max="5" step="0.5" className="flex-1 accent-ink h-1 bg-stone-100 rounded-lg appearance-none cursor-pointer" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} />
                  <span className="text-xs font-bold text-ink w-6">{editingCard.rating}</span>
               </div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="开始日期" type="date" value={editingCard.startDate || ''} onChange={e => setEditingCard({...editingCard, startDate: e.target.value})} />
            <Input label="结束日期" type="date" value={editingCard.endDate || ''} onChange={e => setEditingCard({...editingCard, endDate: e.target.value})} />
          </div>

          <TextArea label="详细描述" value={editingCard.description || ''} onChange={e => setEditingCard({...editingCard, description: e.target.value})} />
          <Button onClick={handleSave} className="w-full h-11 rounded-xl">提交保存</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} title="删除确认" message="确定要永久移除此条记录吗？" confirmText="确认删除" type="danger" />
    </div>
  );
};

const AdminTags: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [newTag, setNewTag] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newTag.trim()) return;
    onUpdate({ ...data, tags: [...data.tags, { id: Date.now().toString(), name: newTag }] });
    setNewTag('');
  };

  const saveEdit = () => {
    if (!tempName.trim()) return;
    const newTags = data.tags.map(t => t.id === editingId ? { ...t, name: tempName } : t);
    onUpdate({ ...data, tags: newTags });
    setEditingId(null);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <AdminCard title="定义新分类">
         <div className="flex gap-3">
           <Input placeholder="输入分类名称..." value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-1" />
           <Button onClick={handleAdd} disabled={!newTag.trim()} className="w-10 h-10 p-0 rounded-lg"><Plus size={20} /></Button>
         </div>
      </AdminCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.tags.map(tag => (
          <div key={tag.id} className="bg-white p-4 rounded-xl border border-stone-200 flex items-center justify-between group">
            {editingId === tag.id ? (
              <div className="flex items-center gap-2 w-full">
                <input className="flex-1 bg-stone-50 border border-stone-200 rounded px-3 py-1.5 text-xs font-bold focus:outline-none" value={tempName} onChange={e => setTempName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                <button onClick={saveEdit} className="p-1.5 bg-ink text-white rounded"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-stone-300"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-stone-50 flex items-center justify-center text-stone-400 font-bold text-[10px] border border-stone-100 uppercase">{tag.name.substring(0,1)}</div>
                  <div>
                    <span className="font-bold text-ink text-sm block">{tag.name}</span>
                    <span className="text-[9px] font-bold text-stone-300 uppercase tracking-wider">{data.cards.filter(c => c.tagIds.includes(tag.id)).length} 条目</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingId(tag.id); setTempName(tag.name); }} className="p-2 text-stone-300 hover:text-ink transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleteId(tag.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) onUpdate({ ...data, tags: data.tags.filter(t => t.id !== deleteId) }); }} title="删除分类" message="此操作将从所有卡片中移除该标签。是否继续？" confirmText="确认删除" type="danger" />
    </div>
  );
};

const AdminSettings: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [testStatus, setTestStatus] = useState<{success?: boolean; message: string} | null>(null);
  const [testing, setTesting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { webdav.getPrivateData().then(setCreds); }, []);

  const runTest = async () => {
    setTesting(true);
    setTestStatus(null);
    const result = await testConnection();
    setTestStatus(result);
    setTesting(false);
  };

  const saveCreds = async () => {
    const result = await webdav.savePrivateData(creds);
    if (result.success) showToast('认证信息更新成功', 'success');
    else showToast('更新失败', 'error');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pb-20">
      <div className="lg:col-span-2 space-y-8">
        <AdminCard title="品牌标识">
           <div className="space-y-6">
             <Input label="网站标题" value={siteSettings.title} onChange={e => { const s = {...siteSettings, title: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} />
             <div className="flex gap-5 items-start">
                <Input label="网站图标 (Favicon) URL" value={siteSettings.iconUrl} onChange={e => { const s = {...siteSettings, iconUrl: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} className="flex-1" />
                <div className="mt-7 w-10 h-10 rounded-lg border border-stone-200 flex items-center justify-center bg-stone-50 overflow-hidden">
                   <img src={siteSettings.iconUrl} alt="Icon" className="w-6 h-6 object-contain" onError={e => e.currentTarget.style.display='none'} />
                </div>
             </div>
           </div>
        </AdminCard>
        
        <AdminCard title="连接测试">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs font-bold text-stone-500 uppercase">WebDAV 协议验证</div>
            <Button onClick={runTest} variant="secondary" size="sm" disabled={testing} className="rounded-lg h-9">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>{testing ? '测试中' : '开始诊断'}</span>
            </Button>
          </div>
          {testStatus && (
            <div className={`mt-6 p-4 rounded-xl text-xs font-bold border flex items-start gap-3 ${testStatus.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              <div className={`p-1.5 rounded ${testStatus.success ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {testStatus.success ? <Check size={14} /> : <AlertCircle size={14} />}
              </div>
              <div className="pt-1 leading-relaxed">{testStatus.message}</div>
            </div>
          )}
        </AdminCard>
      </div>

      <AdminCard title="安全中心" className="border-amber-100">
        <div className="space-y-5">
           <Input label="登录账号" value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} />
           <Input label="管理密码" type="password" value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} />
           <Button variant="danger" className="w-full h-11 rounded-xl shadow-md mt-4" onClick={saveCreds}>
             <CloudUpload size={16} /> 保存安全配置
           </Button>
        </div>
      </AdminCard>
    </div>
  );
};

export default App;
