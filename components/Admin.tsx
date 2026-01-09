import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Loader2, CloudUpload, AlertCircle, Search, X, ChevronLeft, ChevronRight, ThumbsUp, Home, Menu } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { webdav } from '../services/webdavService';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating, TextArea, AdminCard, useToast, ConfirmModal, MultiSelect } from './Common';

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

      {/* 侧边栏 */}
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

const NavButton: React.FC<{ to: string, icon: React.ReactNode, label: string, count?: number }> = ({ to, icon, label, count }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to) && to !== '/';
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
