import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Calendar, Lock, Loader2, Save, CloudUpload, AlertCircle, RefreshCw, X, Check, Search, ExternalLink } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA, testConnection } from './services/webdavService';
import { PublicData, CardData, Tag } from './types';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating, TextArea, AdminCard } from './components/Common';

// --- Main App ---

const App: React.FC = () => {
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
};

// --- Public View ---

const PublicHome: React.FC<{ data: PublicData }> = ({ data }) => {
  const [activeTag, setActiveTag] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  const filteredCards = activeTag === 'all' 
    ? data.cards 
    : data.cards.filter(c => c.tagIds.includes(activeTag));

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-30 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-full bg-stone-100 object-cover border border-stone-100" />
            <h1 className="font-bold text-ink text-lg tracking-tight">{data.settings.title}</h1>
          </div>
          <div className="hidden sm:flex gap-2">
            <button 
              onClick={() => setActiveTag('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTag === 'all' ? 'bg-ink text-white shadow-sm' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
            >
              全部
            </button>
            {data.tags.map(tag => (
              <button 
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTag === tag.id ? 'bg-ink text-white shadow-sm' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:hidden overflow-x-auto px-4 py-2 flex gap-2 no-scrollbar border-t border-border bg-white">
           <button onClick={() => setActiveTag('all')} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeTag === 'all' ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}>全部</button>
           {data.tags.map(tag => (
              <button key={tag.id} onClick={() => setActiveTag(tag.id)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeTag === tag.id ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}>{tag.name}</button>
            ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-subtle opacity-50"><Grid className="w-16 h-16 mb-4 stroke-1" /><p>暂无卡片数据</p></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredCards.map(card => (
              <div key={card.id} onClick={() => setSelectedCard(card)} className="group bg-white rounded-2xl overflow-hidden border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                <div className="aspect-[3/4] overflow-hidden bg-stone-100 relative">
                  <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between">
                    <span className="text-white text-xs font-medium">{card.endDate || '进行中'}</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-ink truncate flex-1 text-sm">{card.title}</h3>
                    <div className="flex-shrink-0"><Rating value={card.rating} /></div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {card.tagIds.map(tid => <span key={tid} className="text-[10px] font-medium px-2 py-0.5 bg-stone-100 text-subtle rounded-md">{data.tags.find(t => t.id === tid)?.name}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal isOpen={!!selectedCard} onClose={() => setSelectedCard(null)} title={selectedCard?.title || ''}>
        {selectedCard && (
          <div className="space-y-6">
            <div className="aspect-video rounded-xl overflow-hidden border border-border shadow-inner bg-stone-100"><ImagePreview src={selectedCard.coverUrl} alt={selectedCard.title} /></div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-stone-50 p-3 rounded-lg border border-border/50">
                 <label className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-1">时间跨度</label>
                 <div className="flex items-center gap-1.5 text-sm font-medium text-ink"><Calendar size={14} /> {selectedCard.startDate} <span className="text-stone-300">/</span> {selectedCard.endDate || '至今'}</div>
               </div>
               <div className="bg-stone-50 p-3 rounded-lg border border-border/50">
                 <label className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-1">个人评分</label>
                 <div className="flex items-center gap-2 text-sm font-medium text-ink"><Rating value={selectedCard.rating} /><span className="text-stone-400 font-mono text-xs">({selectedCard.rating})</span></div>
               </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-2">简介 & 备注</label>
              <div className="text-sm text-ink/80 whitespace-pre-wrap leading-relaxed bg-stone-50 p-4 rounded-xl border border-border/50">
                {selectedCard.description || <span className="text-stone-400 italic">暂无描述信息...</span>}
              </div>
            </div>
            
            {selectedCard.tagIds.length > 0 && (
              <div>
                 <label className="text-[10px] font-bold text-subtle uppercase tracking-wider block mb-2">所属分类</label>
                 <div className="flex flex-wrap gap-2">
                   {selectedCard.tagIds.map(tid => <span key={tid} className="px-2.5 py-1 bg-ink text-white text-xs rounded-full font-medium shadow-sm">{data.tags.find(t => t.id === tid)?.name}</span>)}
                 </div>
              </div>
            )}
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
    const success = await webdav.savePublicData(localData);
    if (success) {
      await refreshData();
      setHasChanges(false);
      alert('已同步到云端');
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
          <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center text-white"><Layout size={18} /></div>
          <span className="font-bold text-ink tracking-tight">后台管理</span>
        </div>
        <div className="p-4">
           <div className="text-xs font-bold text-subtle uppercase tracking-wider px-3 mb-2">内容管理</div>
           <nav className="space-y-1">
             <NavButton to="/tat/cards" icon={<Grid size={18} />} label="所有卡片" count={localData.cards.length} />
             <NavButton to="/tat/tags" icon={<Tags size={18} />} label="标签分类" count={localData.tags.length} />
           </nav>
           <div className="text-xs font-bold text-subtle uppercase tracking-wider px-3 mb-2 mt-6">系统</div>
           <nav className="space-y-1">
             <NavButton to="/tat/settings" icon={<Settings size={18} />} label="网站设置" />
             <a href="/" target="_blank" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-subtle hover:text-ink hover:bg-stone-50 rounded-lg transition-colors group">
                <ExternalLink size={18} className="text-stone-400 group-hover:text-ink" />
                <span>访问前台</span>
             </a>
           </nav>
        </div>
        <div className="mt-auto p-4 border-t border-border">
          <button onClick={() => { localStorage.removeItem('tat_expiry'); window.location.href = '/'; }} className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={18} /><span>退出登录</span></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border h-16 flex items-center justify-between px-6 z-10 sticky top-0">
          <h2 className="text-lg font-bold text-ink hidden md:block capitalize">
            {location.pathname.split('/').pop() === 'cards' ? '卡片管理' : 
             location.pathname.split('/').pop() === 'tags' ? '分类管理' : '系统设置'}
          </h2>
          <div className="md:hidden font-bold">后台管理</div>
          
          <div className="flex items-center gap-4">
            {hasChanges && (
              <div className="hidden sm:flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-100 animate-pulse">
                <AlertCircle size={14} />
                <span>有未保存的修改</span>
              </div>
            )}
            <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" size="sm" className={syncing ? 'opacity-80' : ''}>
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              <span>{syncing ? '同步中...' : '同步到云端'}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
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

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around p-2 pb-safe z-40 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
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
      className={`flex items-center justify-between px-3 py-2 w-full text-sm font-medium rounded-lg transition-all group ${isActive ? 'bg-ink text-white shadow-md' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: isActive ? 'text-white' : 'text-stone-400 group-hover:text-ink' })}
        <span>{label}</span>
      </div>
      {count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-subtle'}`}>{count}</span>}
    </button>
  );
}

const NavButtonMobile: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to);
  return (
    <button onClick={() => navigate(to)} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-full ${isActive ? 'text-ink' : 'text-subtle'}`}>
      <div className={`${isActive ? 'bg-stone-100' : ''} p-1.5 rounded-full transition-colors`}>{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
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
      setError('连接失败，请检查 WebDAV 配置或控制台日志');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-border p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-center mb-6"><div className="p-4 bg-stone-100 rounded-full shadow-inner"><Lock className="w-8 h-8 text-ink" /></div></div>
        <h2 className="text-xl font-bold text-center text-ink mb-2">后台管理</h2>
        <p className="text-center text-subtle text-sm mb-8">请验证您的管理员身份</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="账号" value={username} onChange={e => setUsername(e.target.value)} className="bg-stone-50" />
          <Input label="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} className="bg-stone-50" />
          <div className="flex items-center gap-2"><input type="checkbox" id="keep" checked={keep} onChange={e => setKeep(e.target.checked)} className="rounded border-border text-ink focus:ring-ink" /><label htmlFor="keep" className="text-sm text-subtle select-none cursor-pointer">30天免登录</label></div>
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
          <Button type="submit" className="w-full h-11" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : '登 录'}</Button>
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

  const filtered = data.cards.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

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

  const handleDelete = (id: string) => {
    if (!confirm('此操作不可恢复，确定删除吗？')) return;
    onUpdate({ ...data, cards: data.cards.filter(c => c.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
           <input placeholder="搜索卡片..." className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink transition-all" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setEditingCard({ tagIds: [], rating: 0, description: '' }); setIsModalOpen(true); }}><Plus size={16} /> 新建卡片</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-stone-300 transition-all group flex flex-col h-full">
            <div className="h-40 bg-stone-100 overflow-hidden relative">
              <ImagePreview src={card.coverUrl} alt={card.title} />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-2 bg-white/90 backdrop-blur text-ink hover:text-blue-600 rounded-lg shadow-sm"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(card.id)} className="p-2 bg-white/90 backdrop-blur text-ink hover:text-red-600 rounded-lg shadow-sm"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h4 className="font-bold text-ink truncate mb-1">{card.title}</h4>
              <div className="flex items-center gap-2 mb-3">
                 <Rating value={card.rating} />
                 <span className="text-xs text-stone-400">({card.rating})</span>
              </div>
              <div className="mt-auto pt-3 border-t border-stone-100 flex items-center justify-between">
                 <div className="flex gap-1 overflow-hidden">{card.tagIds.slice(0,2).map(tid => <span key={tid} className="text-[10px] bg-stone-100 text-subtle px-1.5 py-0.5 rounded">{data.tags.find(t=>t.id===tid)?.name}</span>)}</div>
                 <span className="text-[10px] text-stone-400 font-mono">{card.startDate || '未开始'}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
             <div className="mb-2">没有找到相关卡片</div>
             <Button variant="ghost" size="sm" onClick={() => setSearch('')}>清除搜索</Button>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCard.id ? "编辑卡片" : "新建卡片"}>
        <div className="space-y-5">
          <Input label="卡片名称" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} placeholder="例如：黑神话：悟空" />
          <div className="flex gap-4">
             <div className="w-24 h-32 bg-stone-100 rounded-lg overflow-hidden border border-border flex-shrink-0">
               <ImagePreview src={editingCard.coverUrl || ''} alt="Preview" />
             </div>
             <div className="flex-1 space-y-4">
               <Input label="封面链接 (URL)" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} placeholder="https://..." />
               <div>
                  <label className="text-xs font-semibold text-subtle uppercase block mb-2">评分 ({editingCard.rating})</label>
                  <input type="range" min="0" max="5" step="0.5" className="w-full accent-ink cursor-pointer" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} />
                  <div className="flex justify-between text-[10px] text-stone-400 px-1 mt-1"><span>0</span><span>2.5</span><span>5</span></div>
               </div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="开始日期" type="date" value={editingCard.startDate || ''} onChange={e => setEditingCard({...editingCard, startDate: e.target.value})} />
            <Input label="结束日期" type="date" value={editingCard.endDate || ''} onChange={e => setEditingCard({...editingCard, endDate: e.target.value})} />
          </div>

          <TextArea label="详细信息 / 简介" value={editingCard.description || ''} onChange={e => setEditingCard({...editingCard, description: e.target.value})} placeholder="输入关于此卡片的详细描述..." />
          
          <div>
            <label className="text-xs font-semibold text-subtle uppercase block mb-3">所属分类</label>
            <div className="flex flex-wrap gap-2 p-3 bg-stone-50 rounded-lg border border-border">
              {data.tags.length === 0 && <span className="text-xs text-stone-400 italic">请先在「分类管理」中添加标签</span>}
              {data.tags.map(tag => {
              const active = editingCard.tagIds?.includes(tag.id);
              return (
                <button 
                  key={tag.id} 
                  onClick={() => {
                    const ids = editingCard.tagIds || [];
                    setEditingCard({...editingCard, tagIds: active ? ids.filter(i => i !== tag.id) : [...ids, tag.id]});
                  }} 
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${active ? 'bg-ink text-white border-ink shadow-sm' : 'bg-white text-subtle border-border hover:border-stone-400'}`}
                >
                  {tag.name}
                </button>
              )})}
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={handleSave} className="w-full">保存卡片</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const AdminTags: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [newTag, setNewTag] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

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
    <div className="space-y-6 max-w-5xl">
      <AdminCard title="添加新分类">
         <div className="flex gap-3">
           <Input placeholder="输入分类名称（如：电影、番剧...）" value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-1" />
           <Button onClick={handleAdd} disabled={!newTag.trim()}>添加</Button>
         </div>
      </AdminCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.tags.map(tag => (
          <div key={tag.id} className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between group hover:border-stone-300 transition-colors">
            {editingId === tag.id ? (
              <div className="flex items-center gap-2 w-full animate-in fade-in duration-200">
                <input 
                  className="flex-1 min-w-0 bg-stone-50 border border-ink/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-ink" 
                  value={tempName} 
                  onChange={e => setTempName(e.target.value)} 
                  autoFocus 
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                />
                <button onClick={saveEdit} className="p-1.5 bg-ink text-white rounded hover:bg-black"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-stone-400 hover:text-ink"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-xs border border-stone-200">
                    {tag.name.substring(0,1)}
                  </div>
                  <span className="font-medium text-ink">{tag.name}</span>
                  <span className="text-xs text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-100">
                    {data.cards.filter(c => c.tagIds.includes(tag.id)).length}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(tag)} className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => onUpdate({ ...data, tags: data.tags.filter(t => t.id !== tag.id) })} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {data.tags.length === 0 && <div className="text-center py-10 text-stone-400 italic">暂无分类数据</div>}
    </div>
  );
};

const AdminSettings: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [testStatus, setTestStatus] = useState<{success?: boolean; message: string} | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { webdav.getPrivateData().then(setCreds); }, []);

  const runTest = async () => {
    setTesting(true);
    setTestStatus(null);
    const result = await testConnection();
    setTestStatus(result);
    setTesting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 space-y-8">
        <AdminCard title="基本设置">
           <div className="space-y-4">
             <Input label="网站名称" value={siteSettings.title} onChange={e => { const s = {...siteSettings, title: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} placeholder="例如：我的收藏集" />
             <div className="flex gap-4 items-start">
                <div className="flex-1">
                   <Input label="网站图标 URL (Favicon)" value={siteSettings.iconUrl} onChange={e => { const s = {...siteSettings, iconUrl: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} placeholder="https://..." />
                   <p className="text-[10px] text-stone-400 mt-1">建议使用 32x32 或更大尺寸的 PNG/ICO 图片</p>
                </div>
                <div className="mt-6 w-10 h-10 rounded border border-border bg-stone-50 flex items-center justify-center overflow-hidden">
                   <img src={siteSettings.iconUrl} alt="Icon" className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display='none')} />
                </div>
             </div>
           </div>
        </AdminCard>
        
        <AdminCard title="连接诊断">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-ink">WebDAV 连通性测试</div>
              <div className="text-xs text-subtle">测试服务器连接及文件夹读写权限</div>
            </div>
            <Button onClick={runTest} variant="secondary" size="sm" disabled={testing}>
              {testing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              {testing ? '测试中' : '开始测试'}
            </Button>
          </div>
          {testStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm border flex items-start gap-2 ${testStatus.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
              {testStatus.success ? <Check size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
              <span>{testStatus.message}</span>
            </div>
          )}
        </AdminCard>
      </div>

      <div className="space-y-8">
        <AdminCard title="管理员账号" className="border-orange-100 shadow-orange-50/50">
          <div className="space-y-4">
             <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-100 leading-relaxed">
               <span className="font-bold block mb-1">安全提示</span>
               WebDAV 仅存储数据文件。管理员账号用于保护后台管理界面，请务必设置强密码。
             </div>
             <Input label="管理账号" value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} />
             <Input label="新密码" type="password" value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} />
             <Button variant="danger" className="w-full mt-2" onClick={async () => { await webdav.savePrivateData(creds); alert('密码已即时更新'); }}>
               <Save size={16} /> 保存账号变更
             </Button>
          </div>
        </AdminCard>

        <div className="text-center">
           <p className="text-xs text-stone-300">NicheCard v0.1.0</p>
        </div>
      </div>
    </div>
  );
};

export default App;