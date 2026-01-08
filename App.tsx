import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Calendar, Lock, Loader2, CloudUpload, AlertCircle, RefreshCw, Check, Search, ExternalLink, X, ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA, testConnection } from './services/webdavService';
import { PublicData, CardData, Tag } from './types';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating, TextArea, AdminCard, ToastProvider, useToast, ConfirmModal, MultiSelect } from './components/Common';

// --- Main App ---

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

// --- Public View (Exhibition Style) ---

const PublicHome: React.FC<{ data: PublicData }> = ({ data }) => {
  const [activeTag, setActiveTag] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  const filteredCards = useMemo(() => activeTag === 'all' 
    ? data.cards 
    : data.cards.filter(c => c.tagIds.includes(activeTag)), [data.cards, activeTag]);

  const getYear = (dateStr?: string) => {
    if (!dateStr || typeof dateStr !== 'string') return 'N/A';
    return dateStr.split('-')[0] || 'N/A';
  };

  return (
    <div className="min-h-screen bg-[#fcfcfb] flex flex-col lg:flex-row font-sans selection:bg-ink selection:text-white">
      {/* Dynamic Sidebar Nav */}
      <aside className="lg:w-80 lg:h-screen lg:sticky lg:top-0 bg-white border-r border-stone-100 p-10 flex flex-col z-40">
        <div className="flex items-center gap-4 mb-20 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="relative">
             <img src={data.settings.iconUrl} alt="Logo" className="w-12 h-12 rounded-2xl shadow-xl object-cover relative z-10" />
             <div className="absolute inset-0 bg-ink rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
          </div>
          <div>
            <h1 className="font-black text-2xl text-ink leading-none tracking-tighter uppercase">{data.settings.title}</h1>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] text-stone-400 font-black uppercase tracking-[0.2em]">Live Archive</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1">
          <button 
            onClick={() => setActiveTag('all')}
            className={`group flex items-center justify-between py-4 px-5 rounded-2xl transition-all duration-500 ${activeTag === 'all' ? 'bg-ink text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] translate-x-2' : 'text-subtle hover:text-ink hover:bg-stone-50'}`}
          >
            <span className="text-sm font-black tracking-tight uppercase">Show All</span>
            <span className={`text-[10px] font-mono font-bold ${activeTag === 'all' ? 'opacity-50' : 'text-stone-300'}`}>{data.cards.length}</span>
          </button>
          
          <div className="h-px bg-stone-50 my-8 w-1/2" />
          
          {data.tags.map(tag => {
            const count = data.cards.filter(c => c.tagIds.includes(tag.id)).length;
            return (
              <button 
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                className={`group flex items-center justify-between py-4 px-5 rounded-2xl transition-all duration-500 ${activeTag === tag.id ? 'bg-ink text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] translate-x-2' : 'text-subtle hover:text-ink hover:bg-stone-50'}`}
              >
                <span className="text-sm font-black tracking-tight uppercase">{tag.name}</span>
                <span className={`text-[10px] font-mono font-bold ${activeTag === tag.id ? 'opacity-50' : 'text-stone-300'}`}>{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-10 pt-10 border-t border-stone-50 space-y-4">
           <div className="flex items-center gap-3 text-stone-300">
             <Sparkles size={14} />
             <p className="text-[10px] font-bold uppercase tracking-widest">Niche Archive Project</p>
           </div>
           <p className="text-[11px] text-stone-400 leading-relaxed italic">"Everything you collect is a piece of the puzzle that is you."</p>
        </div>
      </aside>

      {/* Exhibition Content */}
      <main className="flex-1 p-6 md:p-16 lg:p-24 overflow-x-hidden">
        {filteredCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-40">
            <div className="relative mb-10">
               <Grid className="w-32 h-32 text-stone-100 stroke-[0.5]" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-4 h-4 bg-stone-200 rounded-full animate-ping" />
               </div>
            </div>
            <p className="text-2xl font-black text-stone-200 uppercase tracking-widest">Archive Empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12">
            {filteredCards.map((card, idx) => (
              <div 
                key={card.id} 
                onClick={() => setSelectedCard(card)} 
                className={`group cursor-pointer relative animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both ${idx === 0 ? 'md:col-span-2 xl:col-span-2' : ''}`}
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className="relative overflow-hidden rounded-[3rem] bg-stone-100 aspect-video shadow-2xl transition-all duration-700 group-hover:shadow-[0_60px_100px_-20px_rgba(0,0,0,0.2)] group-hover:-translate-y-3">
                   <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full scale-110 group-hover:scale-100 transition-transform duration-[1.5s] ease-out" />
                   
                   {/* Artistic Overlays */}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
                   
                   {/* Info Floating Tag */}
                   <div className="absolute top-8 left-8">
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full flex items-center gap-3">
                         <span className="text-[10px] font-black text-white uppercase tracking-widest">{getYear(card.startDate)}</span>
                         <div className="w-1 h-1 rounded-full bg-white/40" />
                         <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{data.tags.find(t => t.id === card.tagIds[0])?.name || 'Item'}</span>
                      </div>
                   </div>

                   {/* Title & Interaction Label */}
                   <div className="absolute bottom-10 left-10 right-10">
                      <div className="flex items-end justify-between gap-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-700">
                         <div className="flex-1 min-w-0">
                            <h3 className="font-black text-white text-3xl md:text-4xl tracking-tighter uppercase truncate mb-4 drop-shadow-2xl">{card.title}</h3>
                            <div className="flex items-center gap-4">
                               <Rating value={card.rating} />
                               <div className="h-px w-8 bg-white/20" />
                               <span className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em]">{card.endDate ? 'Archived' : 'Ongoing'}</span>
                            </div>
                         </div>
                         <div className="flex-shrink-0 w-16 h-16 rounded-full bg-white text-ink flex items-center justify-center shadow-2xl transition-all duration-500 scale-0 group-hover:scale-100 group-hover:rotate-[360deg]">
                            <ArrowRight size={24} />
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Expanded Modal */}
      <Modal isOpen={!!selectedCard} onClose={() => setSelectedCard(null)} title={selectedCard?.title || ''}>
        {selectedCard && (
          <div className="space-y-12 py-4">
            <div className="aspect-video rounded-[3rem] overflow-hidden border border-stone-100 shadow-2xl group relative">
               <ImagePreview src={selectedCard.coverUrl} alt={selectedCard.title} />
               <div className="absolute inset-0 bg-ink/5 group-hover:bg-transparent transition-colors" />
            </div>
            
            <div className="flex flex-col md:flex-row gap-12">
               <div className="flex-1 space-y-10">
                  <div className="relative">
                    <div className="absolute -left-6 top-0 bottom-0 w-1 bg-ink/5 rounded-full" />
                    <label className="text-[10px] font-black text-stone-300 uppercase tracking-[0.3em] block mb-6">Manifesto & Narrative</label>
                    <div className="text-xl text-ink leading-[1.7] whitespace-pre-wrap font-medium tracking-tight">
                      {selectedCard.description || <span className="text-stone-200 italic font-light tracking-normal text-lg">"Silence is often the most profound description."</span>}
                    </div>
                  </div>
               </div>

               <div className="md:w-64 space-y-8 flex-shrink-0">
                  <div className="bg-stone-50/50 p-8 rounded-[2.5rem] border border-stone-100/50 backdrop-blur-sm">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-4">Historical Record</label>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] font-bold text-stone-300 uppercase tracking-widest mb-1">Initiated</div>
                        <div className="text-sm font-black text-ink font-mono">{selectedCard.startDate || 'Unknown'}</div>
                      </div>
                      <div className="flex justify-center py-2"><div className="w-px h-6 bg-stone-200" /></div>
                      <div>
                        <div className="text-[10px] font-bold text-stone-300 uppercase tracking-widest mb-1">Concluded</div>
                        <div className="text-sm font-black text-ink font-mono">{selectedCard.endDate || 'Active'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-50/50 p-8 rounded-[2.5rem] border border-stone-100/50">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-4">Critical Rating</label>
                    <div className="flex items-center justify-between">
                       <Rating value={selectedCard.rating} />
                       <span className="text-ink font-mono text-lg font-black">{selectedCard.rating}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedCard.tagIds.map(tid => (
                      <span key={tid} className="px-5 py-2.5 bg-white border border-stone-100 text-stone-400 text-[10px] font-black rounded-full uppercase tracking-widest hover:border-ink hover:text-ink transition-all cursor-default">
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

// --- Admin Section ---

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
      showToast('同步成功，数据已更新', 'success');
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
      <aside className="w-64 bg-white border-r border-border flex flex-col hidden md:flex z-20 shadow-sm">
        <div className="h-16 border-b border-border flex items-center px-6 gap-3">
          <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-white shadow-lg"><Layout size={18} /></div>
          <span className="font-bold text-ink tracking-tight uppercase">Admin Panel</span>
        </div>
        <div className="p-4 flex-1">
           <div className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] px-3 mb-4 mt-2">Archives</div>
           <nav className="space-y-1.5">
             <NavButton to="/tat/cards" icon={<Grid size={18} />} label="所有卡片" count={localData.cards.length} />
             <NavButton to="/tat/tags" icon={<Tags size={18} />} label="标签分类" count={localData.tags.length} />
           </nav>
           <div className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] px-3 mb-4 mt-8">System</div>
           <nav className="space-y-1.5">
             <NavButton to="/tat/settings" icon={<Settings size={18} />} label="网站设置" />
             <a href="/" target="_blank" className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-subtle hover:text-ink hover:bg-stone-50 rounded-xl transition-all group">
                <ExternalLink size={18} className="text-stone-300 group-hover:text-ink" />
                <span>访问前台</span>
             </a>
           </nav>
        </div>
        <div className="p-4 border-t border-border">
          <button onClick={() => { localStorage.removeItem('tat_expiry'); window.location.href = '/'; }} className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"><LogOut size={18} /><span>退出系统</span></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-xl border-b border-border h-16 flex items-center justify-between px-6 z-10 sticky top-0">
          <h2 className="text-sm font-black text-ink uppercase tracking-widest hidden md:block">
            {location.pathname.split('/').pop() === 'cards' ? 'Archive Management' : 
             location.pathname.split('/').pop() === 'tags' ? 'Categories' : 'System Configuration'}
          </h2>
          <div className="md:hidden font-black uppercase text-xs tracking-widest">Niche Admin</div>
          
          <div className="flex items-center gap-4">
            {hasChanges && (
              <div className="hidden sm:flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-100 animate-pulse">
                <AlertCircle size={12} />
                <span>Unsaved Modifications</span>
              </div>
            )}
            <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" size="sm" className={`rounded-full px-5 ${syncing ? 'opacity-80' : ''}`}>
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              <span className="font-bold tracking-tight">{syncing ? '同步中...' : '同步云端'}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-10 lg:p-12">
          <div className="max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="cards" element={<AdminCards data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="tags" element={<AdminTags data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="settings" element={<AdminSettings data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="*" element={<Navigate to="cards" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-border flex justify-around p-3 pb-safe z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <NavButtonMobile to="/tat/cards" icon={<Grid size={20} />} label="卡片" />
        <NavButtonMobile to="/tat/tags" icon={<Tags size={20} />} label="分类" />
        <NavButtonMobile to="/tat/settings" icon={<Settings size={20} />} label="设置" />
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
      className={`flex items-center justify-between px-3 py-2.5 w-full text-sm font-bold rounded-xl transition-all group ${isActive ? 'bg-ink text-white shadow-xl' : 'text-subtle hover:bg-stone-50 hover:text-ink'}`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: isActive ? 'text-white' : 'text-stone-300 group-hover:text-ink' })}
        <span>{label}</span>
      </div>
      {count !== undefined && <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-stone-50 text-stone-300'}`}>{count}</span>}
    </button>
  );
}

const NavButtonMobile: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to);
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-full transition-colors ${isActive ? 'text-ink' : 'text-stone-300'}`}>
      <div className={`${isActive ? 'bg-stone-100' : ''} p-2 rounded-full transition-colors`}>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
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
      console.error(err);
      setError('连接失败，请检查 WebDAV 配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#fafaf9] p-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-stone-100 p-12 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-10">
          <div className="p-6 bg-stone-50 rounded-[2rem] shadow-inner relative group">
             <Lock className="w-10 h-10 text-ink relative z-10" />
             <div className="absolute inset-0 bg-ink rounded-[2rem] opacity-0 group-hover:opacity-5 transition-opacity" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-center text-ink mb-2 uppercase tracking-tight">System Access</h2>
        <p className="text-center text-stone-400 text-sm mb-10 font-medium">Identity verification required.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input label="Identity" value={username} onChange={e => setUsername(e.target.value)} className="bg-stone-50/50 h-12 rounded-2xl" placeholder="Username" />
          <Input label="Credentials" type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-stone-50/50 h-12 rounded-2xl" placeholder="Password" />
          <div className="flex items-center gap-3 px-1"><input type="checkbox" id="keep" checked={keep} onChange={e => setKeep(e.target.checked)} className="w-4 h-4 rounded border-stone-200 text-ink focus:ring-ink" /><label htmlFor="keep" className="text-xs text-stone-400 font-bold uppercase tracking-widest select-none cursor-pointer">Stay Authenticated</label></div>
          {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3 border border-red-100"><AlertCircle size={16} />{error}</div>}
          <Button type="submit" className="w-full h-14 rounded-2xl text-lg shadow-xl" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : 'AUTHENTICATE'}</Button>
        </form>
      </div>
    </div>
  );
};

// --- Admin Views ---

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
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative max-w-sm w-full group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-ink transition-colors" size={18} />
           <input 
              placeholder="Filter archives..." 
              className="w-full pl-12 pr-12 py-3 bg-white border border-stone-200 rounded-2xl text-sm font-bold focus:outline-none focus:border-ink focus:ring-4 focus:ring-stone-100 transition-all placeholder:text-stone-300" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
           />
           {search && (
             <button 
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink transition-colors p-1"
             >
                <X size={18} />
             </button>
           )}
        </div>
        <Button onClick={() => { setEditingCard({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '' }); setIsModalOpen(true); }} className="rounded-2xl px-6 h-12 shadow-lg"><Plus size={20} /> <span className="font-bold">NEW RECORD</span></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {paginatedCards.map(card => (
          <div key={card.id} className="bg-white rounded-[2rem] border border-stone-200 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col h-full">
            <div className="aspect-video bg-stone-50 overflow-hidden relative border-b border-stone-100">
              <ImagePreview src={card.coverUrl} alt={card.title} />
              <div className="absolute inset-0 bg-ink/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-3 bg-white text-ink hover:bg-black hover:text-white rounded-2xl shadow-xl transition-all"><Edit2 size={16} /></button>
                <button onClick={() => setDeleteId(card.id)} className="p-3 bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-2xl shadow-xl transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h4 className="font-black text-ink text-lg truncate mb-2 uppercase tracking-tight">{card.title}</h4>
              <div className="flex items-center gap-3 mb-4">
                 <Rating value={card.rating} />
                 <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">{card.rating} / 5</span>
              </div>
              <div className="mt-auto pt-5 border-t border-stone-50 flex items-center justify-between">
                 <div className="flex gap-1.5 overflow-hidden">
                    {card.tagIds.slice(0,1).map(tid => <span key={tid} className="text-[9px] font-black uppercase tracking-widest bg-stone-50 text-stone-400 px-2 py-1 rounded-lg border border-stone-100">{data.tags.find(t=>t.id===tid)?.name}</span>)}
                    {card.tagIds.length > 1 && <span className="text-[9px] font-black text-stone-300 px-1 py-1">+{card.tagIds.length - 1}</span>}
                 </div>
                 <span className="text-[10px] text-stone-300 font-mono font-bold">{(card.startDate || 'TBA').split('-')[0]}</span>
              </div>
            </div>
          </div>
        ))}
        {paginatedCards.length === 0 && (
          <div className="col-span-full py-32 text-center text-stone-300 border-4 border-dashed border-stone-100 rounded-[3rem]">
             <div className="flex flex-col items-center gap-4">
               <div className="p-8 bg-stone-50 rounded-full"><Search size={64} className="opacity-10" /></div>
               <div className="text-xl font-black uppercase tracking-widest">No Matches Found</div>
               <p className="text-sm font-medium">Try refining your search parameters.</p>
             </div>
          </div>
        )}
      </div>

      {/* Modern Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-12">
          <button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="w-12 h-12 rounded-2xl border border-stone-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-12 h-12 rounded-2xl text-xs font-black transition-all ${currentPage === page ? 'bg-ink text-white shadow-xl scale-110' : 'text-stone-400 hover:bg-stone-50'}`}
              >
                {page}
              </button>
            ))}
          </div>

          <button 
            disabled={currentPage === totalPages} 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="w-12 h-12 rounded-2xl border border-stone-200 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCard.id ? "Edit Record" : "New Archive Record"}>
        <div className="space-y-6">
          <Input label="Record Title" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} placeholder="Masterpiece title..." className="h-12 rounded-xl" />
          
          <MultiSelect 
            label="Categorization"
            options={data.tags}
            value={editingCard.tagIds || []}
            onChange={ids => setEditingCard({...editingCard, tagIds: ids})}
            placeholder="Assign tags..."
          />

          <div className="flex flex-col sm:flex-row gap-6">
             <div className="w-32 h-32 bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 flex-shrink-0 relative">
               <ImagePreview src={editingCard.coverUrl || ''} alt="Preview" className="aspect-video h-full w-full" />
             </div>
             <div className="flex-1 space-y-4">
               <Input label="Cover Asset (URL)" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} placeholder="https://..." className="h-10 rounded-xl" />
               <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Quality Assessment</label>
                    <span className="text-xs font-black font-mono">{editingCard.rating || 0}</span>
                  </div>
                  <input type="range" min="0" max="5" step="0.5" className="w-full accent-ink cursor-pointer h-2 bg-stone-100 rounded-lg appearance-none" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} />
               </div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <Input label="Timeline Start" type="date" value={editingCard.startDate || ''} onChange={e => setEditingCard({...editingCard, startDate: e.target.value})} className="h-10 rounded-xl" />
            <Input label="Timeline End" type="date" value={editingCard.endDate || ''} onChange={e => setEditingCard({...editingCard, endDate: e.target.value})} className="h-10 rounded-xl" />
          </div>

          <TextArea label="The Narrative" value={editingCard.description || ''} onChange={e => setEditingCard({...editingCard, description: e.target.value})} placeholder="Detailed description of this entry..." className="rounded-2xl min-h-[140px]" />
          
          <div className="pt-4">
            <Button onClick={handleSave} className="w-full h-14 rounded-2xl text-lg font-black shadow-xl">COMMIT RECORD</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Record"
        message="Are you sure you want to purge this record from the archive? This action is permanent."
        confirmText="PURGE"
        type="danger"
      />
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

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setTempName(tag.name);
  };

  const saveEdit = () => {
    if (!tempName.trim()) return;
    const newTags = data.tags.map(t => t.id === editingId ? { ...t, name: tempName } : t);
    onUpdate({ ...data, tags: newTags });
    setEditingId(null);
  };

  return (
    <div className="space-y-10 max-w-4xl">
      <AdminCard title="Define New Category" className="rounded-[2.5rem] border-stone-200">
         <div className="flex gap-4">
           <Input placeholder="Category nomenclature (e.g. Cinema, Lit...)" value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-1 h-12 rounded-2xl" />
           <Button onClick={handleAdd} disabled={!newTag.trim()} size="md" className="w-12 h-12 p-0 rounded-2xl">
             <Plus size={24} />
           </Button>
         </div>
      </AdminCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.tags.map(tag => (
          <div key={tag.id} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-center justify-between group hover:border-ink/20 transition-all hover:shadow-xl">
            {editingId === tag.id ? (
              <div className="flex items-center gap-3 w-full animate-in fade-in duration-300">
                <input 
                  className="flex-1 min-w-0 bg-stone-50 border border-ink/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-ink" 
                  value={tempName} 
                  onChange={e => setTempName(e.target.value)} 
                  autoFocus 
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                />
                <button onClick={saveEdit} className="p-2 bg-ink text-white rounded-xl hover:scale-110 transition-transform"><Check size={16} /></button>
                <button onClick={() => setEditingId(null)} className="p-2 text-stone-300 hover:text-ink"><X size={16} /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-400 font-black text-xs border border-stone-100 uppercase">
                    {tag.name.substring(0,1)}
                  </div>
                  <div>
                    <span className="font-black text-ink uppercase tracking-tight block">{tag.name}</span>
                    <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                      {data.cards.filter(c => c.tagIds.includes(tag.id)).length} Entries
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(tag)} className="p-2.5 text-stone-300 hover:text-ink hover:bg-stone-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                  <button onClick={() => setDeleteId(tag.id)} className="p-2.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {data.tags.length === 0 && <div className="text-center py-20 text-stone-200 italic font-medium uppercase tracking-[0.2em] animate-pulse">Category Index Empty</div>}

      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
           if (deleteId) onUpdate({ ...data, tags: data.tags.filter(t => t.id !== deleteId) });
        }}
        title="Delete Category"
        message="Purging this category will remove it from all associated archive entries. Proceed?"
        confirmText="CONFIRM PURGE"
        type="danger"
      />
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
    if (result.success) showToast('Credentials updated successfully', 'success');
    else showToast(`Update failed: ${result.error}`, 'error');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start pb-20">
      <div className="lg:col-span-2 space-y-10">
        <AdminCard title="Brand Identity" className="rounded-[2.5rem]">
           <div className="space-y-6">
             <Input label="Archive Title" value={siteSettings.title} onChange={e => { const s = {...siteSettings, title: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} placeholder="e.g. My Infinite Archive" className="h-12 rounded-2xl" />
             <div className="flex gap-6 items-start">
                <div className="flex-1">
                   <Input label="Archive Icon URL" value={siteSettings.iconUrl} onChange={e => { const s = {...siteSettings, iconUrl: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} placeholder="https://..." className="h-10 rounded-2xl" />
                   <p className="text-[10px] text-stone-300 mt-3 font-bold uppercase tracking-widest">Recommended: High-res square PNG (min 128px)</p>
                </div>
                <div className="mt-8 w-16 h-16 rounded-[1.5rem] border border-stone-100 bg-stone-50 flex items-center justify-center overflow-hidden shadow-inner group relative">
                   <img src={siteSettings.iconUrl} alt="Icon" className="w-10 h-10 object-contain relative z-10" onError={(e) => (e.currentTarget.style.display='none')} />
                   <div className="absolute inset-0 bg-ink opacity-0 group-hover:opacity-5 transition-opacity" />
                </div>
             </div>
           </div>
        </AdminCard>
        
        <AdminCard title="Connectivity Diagnostic" className="rounded-[2.5rem]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="text-sm font-black text-ink uppercase tracking-tight">WebDAV Protocol Validation</div>
              <div className="text-xs text-stone-400 font-medium">Verify server accessibility and R/W permissions.</div>
            </div>
            <Button onClick={runTest} variant="secondary" size="md" disabled={testing} className="rounded-2xl px-6 h-12 min-w-[140px]">
              {testing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              <span className="font-bold">{testing ? 'Testing...' : 'Initialize Test'}</span>
            </Button>
          </div>
          {testStatus && (
            <div className={`mt-8 p-6 rounded-3xl text-sm font-bold border flex items-start gap-4 animate-in slide-in-from-top-4 duration-500 ${testStatus.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              <div className={`p-2 rounded-xl ${testStatus.success ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {testStatus.success ? <Check size={18} /> : <AlertCircle size={18} />}
              </div>
              <div className="pt-1.5 leading-relaxed">{testStatus.message}</div>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="space-y-10">
        <AdminCard title="Security Core" className="rounded-[2.5rem] border-amber-100 shadow-amber-900/5">
          <div className="space-y-6">
             <div className="p-5 bg-amber-50/50 text-amber-900 text-[11px] font-bold rounded-[1.5rem] border border-amber-100 leading-relaxed space-y-2">
               <div className="flex items-center gap-2"><AlertCircle size={14} className="text-amber-500" /> <span className="uppercase tracking-widest">Security Protocol</span></div>
               <p className="font-medium opacity-80 italic">Credentials here only protect this interface. Actual data security depends on your WebDAV provider.</p>
             </div>
             <Input label="Admin Identifier" value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} className="h-10 rounded-xl" />
             <Input label="New Secret Key" type="password" value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} className="h-10 rounded-xl" />
             <Button variant="danger" className="w-full h-12 rounded-2xl shadow-lg mt-4" onClick={saveCreds}>
               <CloudUpload size={18} /> <span className="font-bold">COMMIT SECURITY UPDATES</span>
             </Button>
          </div>
        </AdminCard>

        <div className="text-center space-y-2">
           <div className="font-black text-[10px] text-stone-200 uppercase tracking-[0.4em]">Engineered Excellence</div>
           <p className="text-[10px] text-stone-300 font-mono font-bold italic">NicheCard v0.1.5-Release</p>
        </div>
      </div>
    </div>
  );
};

export default App;
