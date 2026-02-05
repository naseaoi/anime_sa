
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Loader2, CloudUpload, AlertCircle, Search, X, ChevronLeft, ChevronRight, ThumbsUp, Home, Menu, Check, Database, RefreshCw, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { getStorage, webdavAdapter, sqliteAdapter } from '../services/storageFactory';
import { Button, Input, PageLoader, Rating, AdminCard, useToast, ConfirmModal } from './Common';
import { CardEditModal } from './CardEditModal';

interface AdminLayoutProps {
  initialData: PublicData;
  refreshData: () => Promise<void>;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ initialData, refreshData }) => {
  const [localData, setLocalData] = useState<PublicData>(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { showToast } = useToast();
  const storageType = getStorage().type;

  useEffect(() => {
    const expiry = localStorage.getItem('tat_expiry');
    if (expiry && new Date().getTime() < parseInt(expiry)) setIsAuth(true);
    setChecking(false);
  }, []);

  // 增加：同步浏览器标题和图标
  useEffect(() => {
    if (localData.settings.title) {
      document.title = `${localData.settings.title} - 管理后台`;
    }
    if (localData.settings.iconUrl) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) favicon.href = localData.settings.iconUrl;
    }
  }, [localData.settings]);

  const handleDataChange = (newData: PublicData) => {
    setLocalData(newData);
    setHasChanges(true);
  };

  const handleSync = async () => {
    setSyncing(true);
    const webdav = getStorage();
    const dataToSave = { ...localData, updatedAt: Date.now() };
    if (storageType === 'sqlite') {
       // For SQLite, we want to ensure we're saving the LATEST state including the new/edited card
       // The `localData` state in AdminLayout might be stale if `onUpdate` hasn't fully propagated or if `handleSync` uses a closure-captured value.
       // However, `handleDataChange` updates `localData`.
       // The issue might be that `handleSync` is manually triggered.
       // In SQLite mode, `handleDataChange` updates local React state, but doesn't auto-save to DB unless we implement auto-save.
       // The user clicks "Save Changes" which calls `handleSync`.
       
       // Wait, `handleSync` logic:
       // 1. const dataToSave = { ...localData, updatedAt: Date.now() };
       // 2. await webdav.savePublicData(dataToSave);
       // 3. setLocalData(dataToSave);
       // 4. await refreshData();
       
       // If `refreshData` fetches from DB, and `savePublicData` worked, it should be fine.
       // The issue "new card disappears" suggests `savePublicData` might be failing or `localData` didn't have the new card yet?
       // Ah, `AdminCards` calls `onUpdate` which calls `handleDataChange` which sets `localData`.
       // Then user clicks `handleSync` (which is the button in header).
       
       // Let's look at `handleSave` in `AdminCards`:
       // It updates `data.cards` and calls `onUpdate`.
       // This updates `localData` in `AdminLayout`.
       // Then user clicks "Save Changes" (handleSync).
       
       // If it disappears, maybe `savePublicData` in SQLite adapter has a bug?
       // Or `refreshData` is fetching old data?
    }
    
    const result = await webdav.savePublicData(dataToSave);
    if (result.success) {
      // Update local data with the timestamp we just generated
      setLocalData(dataToSave);
      
      // IMPORTANT: For SQLite, since we just saved what is in memory, we don't necessarily need to re-fetch immediately 
      // if we trust our save. But re-fetching ensures we are in sync with DB triggers/defaults if any.
      // However, if the DB save failed silently or partial, re-fetch would show that.
      
      await refreshData();
      localStorage.setItem('tat_site_settings', JSON.stringify(dataToSave.settings));
      setHasChanges(false);
      showToast(storageType === 'sqlite' ? '已保存更改' : '数据同步成功', 'success');
    } else {
      showToast(`${storageType === 'sqlite' ? '保存' : '同步'}失败: ${result.error}`, 'error');
    }
    setSyncing(false);
  };

  if (checking) return <PageLoader />;
  if (!isAuth) return <AdminLogin onLogin={(keep) => {
    setIsAuth(true);
    localStorage.setItem('tat_expiry', (new Date().getTime() + (keep ? 30 : 1) * 24 * 60 * 60 * 1000).toString());
  }} />;

  return (
    <div className="flex h-screen bg-stone-50 dark:bg-[#0c0c0c] overflow-hidden font-sans transition-colors duration-300">
      {/* 移动端侧边栏遮罩 */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* 侧边栏 */}
    <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-[#18181b] border-r border-stone-200 dark:border-zinc-800 flex flex-col z-40 fixed inset-y-0 left-0 transform transition-all duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className={`h-20 border-b border-stone-100 dark:border-zinc-800 flex items-center ${sidebarCollapsed ? 'justify-center' : 'px-8 justify-between'} gap-4`}>
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <div className="w-8 h-8 bg-ink dark:bg-zinc-700 rounded-lg flex items-center justify-center text-white"><Layout size={18} /></div>
            {!sidebarCollapsed && <span className="font-bold text-ink dark:text-zinc-100 text-lg whitespace-nowrap overflow-hidden">后台管理</span>}
          </div>
          {!sidebarCollapsed && <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-stone-400 hover:text-ink dark:hover:text-zinc-200"><X size={20} /></button>}
        </div>
        <div className="p-4 flex-1">
           <nav className="space-y-2">
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/cards" icon={<Grid size={20} />} label="卡片管理" count={localData.cards.length} collapsed={sidebarCollapsed} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/tags" icon={<Tags size={20} />} label="分类管理" count={localData.tags.length} collapsed={sidebarCollapsed} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/sync" icon={<RefreshCw size={20} />} label="数据同步" collapsed={sidebarCollapsed} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><NavButton to="/tat/settings" icon={<Settings size={20} />} label="网站设置" collapsed={sidebarCollapsed} /></div>
           </nav>
        </div>
        <div className="p-4 border-t border-stone-100 dark:border-zinc-800 flex flex-col gap-2">
          {/* 修改：移除外层 div 的 onClick 强制刷新，NavButton 内部已处理路由跳转 */}
          <div><NavButton to="/" icon={<Home size={20} />} label="返回首页" collapsed={sidebarCollapsed} /></div>
          <button onClick={() => { localStorage.removeItem('tat_expiry'); window.location.href = '/'; }} className={`flex items-center gap-3 px-4 py-3 w-full text-base font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <LogOut size={20} />
            {!sidebarCollapsed && <span className="whitespace-nowrap overflow-hidden">退出登录</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-[#18181b] border-b border-stone-100 dark:border-zinc-800 h-20 flex items-center justify-between px-6 sm:px-8 z-10 sticky top-0 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg"><Menu size={20} /></button>
            <h2 className="text-lg font-bold text-ink dark:text-zinc-100">
              {location.pathname.includes('cards') ? '卡片档案' : 
               location.pathname.includes('tags') ? '分类配置' : 
               location.pathname.includes('sync') ? '数据同步' : '系统参数'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {hasChanges && <div className="hidden sm:flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg text-xs font-bold border border-amber-100 dark:border-amber-900/30"><AlertCircle size={14} /><span>有待同步的修改</span></div>}
            <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" size="md" className="rounded-xl h-10 px-5">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : (storageType === 'sqlite' ? <Database size={16} /> : <CloudUpload size={16} />)}
              <span>{syncing ? (storageType === 'sqlite' ? '保存中' : '同步中') : (storageType === 'sqlite' ? '保存更改' : '同步云端')}</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10"><div className="max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="cards" element={<AdminCards data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="tags" element={<AdminTags data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="sync" element={<AdminSync />} />
              <Route path="settings" element={<AdminSettings data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="*" element={<Navigate to="cards" replace />} />
            </Routes>
          </div></main>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ to: string, icon: React.ReactNode, label: string, count?: number, collapsed?: boolean }> = ({ to, icon, label, count, collapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to) && to !== '/';
  return (
    <button onClick={() => navigate(to)} className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'} py-3 w-full text-base font-bold rounded-xl transition-all ${isActive ? 'bg-ink text-white shadow-md dark:bg-zinc-100 dark:text-black' : 'text-stone-500 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800 hover:text-ink dark:hover:text-zinc-200'}`} title={collapsed ? label : undefined}>
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>{icon}{!collapsed && <span className="whitespace-nowrap overflow-hidden">{label}</span>}</div>
      {!collapsed && count !== undefined && <span className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-stone-100 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500'}`}>{count}</span>}
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
      const webdav = getStorage();
      if (webdav.login) {
        const res = await webdav.login(username, password);
        if (res.success) onLogin(keep);
        else setError(res.error || '账号或密码错误');
      } else {
        const secrets = await webdav.getPrivateData();
        if (username === secrets.username && password === secrets.password) onLogin(keep);
        else setError('账号或密码错误');
      }
    } catch (err) { setError('连接失败，请检查配置'); } finally { setLoading(false); }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 dark:bg-[#0c0c0c] p-6 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl shadow-xl border border-stone-100 dark:border-zinc-800 p-12">
        <h2 className="text-2xl font-bold text-center text-ink dark:text-white mb-10">后台管理登录</h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          <Input label="账号" value={username} onChange={e => setUsername(e.target.value)} className="h-12 text-base" />
          <Input label="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 text-base" />
          <div className="flex items-center gap-2 px-1"><input type="checkbox" id="keep" checked={keep} onChange={e => setKeep(e.target.checked)} className="w-5 h-5 rounded border-stone-300 text-ink focus:ring-ink" /><label htmlFor="keep" className="text-sm font-bold text-stone-500 dark:text-zinc-400 cursor-pointer">保持登录</label></div>
          {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl border border-red-100 dark:border-red-900/30">{error}</div>}
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
  const itemsPerPage = 15;

  const filtered = useMemo(() => data.cards.filter(c => c.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [data.cards, search]);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedCards = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSave = async (cardData: Partial<CardData>) => {
    const newCards = [...data.cards];
    const now = Date.now();
    if (cardData.id) {
      const idx = newCards.findIndex(c => c.id === cardData.id);
      if (idx !== -1) newCards[idx] = { ...cardData, updatedAt: now } as CardData;
    } else {
      newCards.push({ 
        id: now.toString(),
        title: cardData.title || '',
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
      } as CardData);
    }
    onUpdate({ ...data, cards: newCards });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative max-w-sm w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} /><input placeholder="搜索记录..." className="w-full pl-11 pr-10 py-3 bg-white dark:bg-[#18181b] border border-stone-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-ink dark:text-zinc-200 focus:outline-none focus:border-ink dark:focus:border-zinc-500 transition-all" value={search} onChange={e => setSearch(e.target.value)} />{search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 hover:text-ink dark:hover:text-zinc-100"><X size={16} /></button>}</div>
        <Button onClick={() => { setEditingCard({ tagIds: [], rating: 0, description: '', startDate: '', endDate: '', isRecommended: false, isWatching: false }); setIsModalOpen(true); }} size="md" className="rounded-xl h-11 px-6"><Plus size={18} /> 新建记录</Button>
      </div>

      <div className="flex flex-col gap-3">
        {paginatedCards.map(card => (
          <div key={card.id} className={`bg-white dark:bg-[#1f1f1f] rounded-xl border flex items-center p-3 gap-4 group hover:border-stone-400 dark:hover:border-zinc-500 transition-all shadow-sm ${card.isRecommended ? 'border-amber-200 dark:border-amber-800/50 ring-2 ring-amber-50 dark:ring-amber-900/10' : 'border-stone-200 dark:border-zinc-800'}`}>
            
            <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700">
               {card.coverUrl ? (
                   <ImageIcon size={20} className="text-emerald-500 dark:text-emerald-400" />
               ) : (
                   <ImageIcon size={20} className="text-stone-300 dark:text-zinc-600" />
               )}
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5 sm:col-span-4">
                    <h4 className="font-bold text-ink dark:text-zinc-100 text-sm truncate">{card.title}</h4>
                    <div className="text-xs text-stone-400 dark:text-zinc-500 truncate mt-0.5">{new Date(card.createdAt).toLocaleDateString()}</div>
                </div>
                
                <div className="col-span-3 sm:col-span-2 flex items-center">
                    <span className="bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide truncate max-w-full">
                        {data.tags.find(t=>t.id===card.tagIds[0])?.name || '未分类'}
                    </span>
                </div>

                <div className="hidden sm:flex col-span-3 items-center">
                    <Rating value={card.rating} />
                </div>

                <div className="hidden sm:flex col-span-1 justify-center">
                     {card.isRecommended && <ThumbsUp size={14} className="text-amber-500" />}
                </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-2 text-stone-400 hover:text-ink hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><Edit2 size={16} /></button>
                <button onClick={() => setDeleteId(card.id)} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
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

      <CardEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCard.id ? "编辑记录" : "新建记录"}
        initialCard={editingCard}
        tags={data.tags}
        onSave={handleSave}
      />

      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => onUpdate({ ...data, cards: data.cards.filter(c => c.id !== deleteId) })} title="删除确认" message="确定要永久移除此记录吗？" confirmText="删除" type="danger" />
    </div>
  );
};

const AdminTags: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const { showToast } = useToast();

  const handleAdd = () => {
    if (!newTagName.trim()) return;
    const newId = Date.now().toString();
    const newTags = [...data.tags, { id: newId, name: newTagName.trim() }];
    onUpdate({ ...data, tags: newTags });
    setNewTagName('');
    showToast('分类添加成功', 'success');
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    const newTags = data.tags.map(t => t.id === id ? { ...t, name: editName.trim() } : t);
    onUpdate({ ...data, tags: newTags });
    setEditingId(null);
    showToast('分类更新成功', 'success');
  };

  const handleDelete = (id: string) => {
    const isUsed = data.cards.some(c => c.tagIds.includes(id));
    if (isUsed) {
      showToast('无法删除：该分类下还有关联的记录', 'error');
      return;
    }
    const newTags = data.tags.filter(t => t.id !== id);
    onUpdate({ ...data, tags: newTags });
    showToast('分类已移除', 'success');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <AdminCard title="添加新分类">
        <div className="flex gap-4">
          <Input 
            placeholder="输入分类名称..." 
            value={newTagName} 
            onChange={e => setNewTagName(e.target.value)} 
            className="h-12 text-base"
          />
          <Button onClick={handleAdd} disabled={!newTagName.trim()} className="h-12 px-8 rounded-xl shrink-0">
            <Plus size={18} /> 添加
          </Button>
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.tags.map(tag => (
          <div key={tag.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-sm flex items-center justify-between group">
            {editingId === tag.id ? (
              <div className="flex items-center gap-2 w-full">
                <input 
                  autoFocus
                  className="w-full px-2 py-1 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-600 rounded text-sm focus:outline-none focus:border-ink dark:focus:border-zinc-400 text-ink dark:text-zinc-100"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter') handleUpdate(tag.id); }}
                />
                <button onClick={() => handleUpdate(tag.id)} className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 rounded hover:bg-stone-200 dark:hover:bg-zinc-700"><X size={14} /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-stone-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-stone-400 dark:text-zinc-500 font-bold text-sm">
                    {tag.name.slice(0, 1)}
                  </div>
                  <span className="font-bold text-ink dark:text-zinc-100">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); }} className="p-2 text-stone-400 hover:text-ink hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(tag.id)} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminSync: React.FC = () => {
  const [currentMode] = useState<'webdav' | 'sqlite'>(getStorage().type);
  const [migrating, setMigrating] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{webdav?: number, sqlite?: number} | null>(null);
  const { showToast } = useToast();

  const handleModeSwitch = (mode: 'webdav' | 'sqlite') => {
    if (mode === currentMode) return;
    localStorage.setItem('tat_storage_mode', mode);
    localStorage.removeItem('tat_expiry'); // Force re-login to update credentials context
    window.location.reload();
  };

  const loadSyncInfo = async () => {
    setSyncInfo(null);
    try {
        const [w, s] = await Promise.all([webdavAdapter.getPublicData(), sqliteAdapter.getPublicData()]);
        setSyncInfo({ webdav: w.updatedAt || 0, sqlite: s.updatedAt || 0 });
    } catch(e) {
        showToast('获取版本信息失败', 'error');
    }
  };

  useEffect(() => { loadSyncInfo(); }, []);

  const [syncConfirm, setSyncConfirm] = useState<{ isOpen: boolean; direction: 'to_sqlite' | 'to_webdav' | null }>({ isOpen: false, direction: null });

  const executeSync = async (direction: 'to_sqlite' | 'to_webdav') => {
    setMigrating(true);
    try {
      const sourceAdapter = direction === 'to_sqlite' ? webdavAdapter : sqliteAdapter;
      const targetAdapter = direction === 'to_sqlite' ? sqliteAdapter : webdavAdapter;
      
      showToast('正在读取源数据...', 'info');
      const publicData = await sourceAdapter.getPublicData();
      const privateData = await sourceAdapter.getPrivateData();
      
      showToast('正在写入目标...', 'info');
      const pubRes = await targetAdapter.savePublicData(publicData);
      if (!pubRes.success) throw new Error(pubRes.error);
      
      const privRes = await targetAdapter.savePrivateData(privateData);
      if (!privRes.success) throw new Error(privRes.error);
      
      showToast('数据同步成功！', 'success');
      loadSyncInfo();
    } catch (e: any) {
      showToast(`同步失败: ${e.message}`, 'error');
    } finally {
      setMigrating(false);
      setSyncConfirm({ isOpen: false, direction: null });
    }
  };

  const requestSync = (direction: 'to_sqlite' | 'to_webdav') => {
      setSyncConfirm({ isOpen: true, direction });
  };

  const formatDate = (ts?: number) => (ts && ts > 0) ? new Date(ts).toLocaleString() : '未知/无数据';

  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto">
      <AdminCard title="存储设置">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => handleModeSwitch('webdav')}
                 className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${currentMode === 'webdav' ? 'border-ink bg-stone-50 dark:bg-zinc-800 dark:border-zinc-100' : 'border-stone-100 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-600'}`}
               >
                 <CloudUpload size={24} className={currentMode === 'webdav' ? 'text-ink dark:text-zinc-100' : 'text-stone-400'} />
                 <span className={`font-bold ${currentMode === 'webdav' ? 'text-ink dark:text-zinc-100' : 'text-stone-400'}`}>WebDAV</span>
               </button>
               <button 
                 onClick={() => handleModeSwitch('sqlite')}
                 className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${currentMode === 'sqlite' ? 'border-ink bg-stone-50 dark:bg-zinc-800 dark:border-zinc-100' : 'border-stone-100 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-600'}`}
               >
                 <Database size={24} className={currentMode === 'sqlite' ? 'text-ink dark:text-zinc-100' : 'text-stone-400'} />
                 <span className={`font-bold ${currentMode === 'sqlite' ? 'text-ink dark:text-zinc-100' : 'text-stone-400'}`}>SQLite</span>
               </button>
            </div>
            
            <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-4">
              <h4 className="font-bold text-ink dark:text-zinc-100">数据状态</h4>
              
              {!syncInfo ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-ink" size={32} /></div>
              ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-stone-50 dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700">
                            <div className="font-bold text-stone-500 mb-2 flex items-center gap-2"><CloudUpload size={16}/> WebDAV</div>
                            <div className="text-sm font-mono text-ink dark:text-zinc-200">{formatDate(syncInfo.webdav)}</div>
                        </div>
                        <div className="p-4 bg-stone-50 dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700">
                            <div className="font-bold text-stone-500 mb-2 flex items-center gap-2"><Database size={16}/> SQLite</div>
                            <div className="text-sm font-mono text-ink dark:text-zinc-200">{formatDate(syncInfo.sqlite)}</div>
                        </div>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                        <Button 
                            onClick={() => requestSync('to_sqlite')} 
                            disabled={migrating} 
                            variant="secondary" 
                            className="w-full justify-between h-14 px-4"
                        >
                            <span className="flex items-center gap-2">
                                <CloudUpload size={18} />
                                <span>WebDAV 覆盖到 SQLite</span>
                            </span>
                            {migrating ? <Loader2 className="animate-spin" /> : <ChevronRight size={18} className="text-stone-400" />}
                        </Button>
                        <Button 
                            onClick={() => requestSync('to_webdav')} 
                            disabled={migrating} 
                            variant="secondary" 
                            className="w-full justify-between h-14 px-4"
                        >
                             <span className="flex items-center gap-2">
                                <Database size={18} />
                                <span>SQLite 覆盖到 WebDAV</span>
                            </span>
                             {migrating ? <Loader2 className="animate-spin" /> : <ChevronRight size={18} className="text-stone-400" />}
                        </Button>
                    </div>
                    <p className="text-xs text-stone-400 text-center">注意：同步操作将完全覆盖目标端的数据，不可恢复。</p>
                  </>
              )}
            </div>
          </div>
        </AdminCard>
        
        <ConfirmModal 
            isOpen={syncConfirm.isOpen} 
            onClose={() => setSyncConfirm({ isOpen: false, direction: null })} 
            onConfirm={() => syncConfirm.direction && executeSync(syncConfirm.direction)} 
            title="数据覆盖确认" 
            message={`确定要执行从 ${syncConfirm.direction === 'to_sqlite' ? 'WebDAV 到 SQLite' : 'SQLite 到 WebDAV'} 的覆盖同步吗？目标端现有数据将被永久覆盖且不可恢复。`} 
            confirmText="确认覆盖" 
            type="danger" 
        />
    </div>
  );
};

const AdminSettings: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { const webdav = getStorage(); webdav.getPrivateData().then(setCreds); }, []);

  // Removed unused destructuring line if it existed in the state
  
  return (
    <div className="flex flex-col gap-10 max-w-4xl mx-auto">
      <div className="w-full">
        <AdminCard title="网站设置"><div className="space-y-8"><Input label="网站标题" value={siteSettings.title} onChange={e => { const s = {...siteSettings, title: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} className="h-12 text-base" /><Input label="图标 (URL)" value={siteSettings.iconUrl} onChange={e => { const s = {...siteSettings, iconUrl: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} className="h-12 text-base" /></div></AdminCard>
      </div>
      <div className="w-full">
        <AdminCard title="安全选项">
          <div className="space-y-6">
            <Input label="账号" value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} className="h-12 text-base" />
            <div className="relative">
              <Input label="密码" type={showPassword ? "text" : "password"} value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} className="h-12 text-base" />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[38px] text-stone-400 hover:text-ink dark:hover:text-zinc-200">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <Button className="w-full h-12 rounded-xl text-base" onClick={async () => { const webdav = getStorage(); const res = await webdav.savePrivateData(creds); if(res.success) showToast('已保存'); else showToast('失败','error'); }}>保存安全配置</Button>
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
