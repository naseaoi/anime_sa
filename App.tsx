import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Calendar, Lock, Loader2, Save, CloudUpload, AlertCircle } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA } from './services/webdavService';
import { PublicData, CardData, Tag } from './types';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating, TextArea } from './components/Common';

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
      <header className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-full bg-stone-100 object-cover" />
            <h1 className="font-bold text-ink text-lg tracking-tight">{data.settings.title}</h1>
          </div>
          <div className="hidden sm:flex gap-2">
            <button 
              onClick={() => setActiveTag('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTag === 'all' ? 'bg-ink text-white' : 'text-subtle hover:bg-stone-100'}`}
            >
              全部
            </button>
            {data.tags.map(tag => (
              <button 
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTag === tag.id ? 'bg-ink text-white' : 'text-subtle hover:bg-stone-100'}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:hidden overflow-x-auto px-4 py-2 flex gap-2 no-scrollbar border-t border-border bg-white">
           <button onClick={() => setActiveTag('all')} className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${activeTag === 'all' ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}>全部</button>
           {data.tags.map(tag => (
              <button key={tag.id} onClick={() => setActiveTag(tag.id)} className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${activeTag === tag.id ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}>{tag.name}</button>
            ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-subtle opacity-50"><Grid className="w-12 h-12 mb-4" /><p>暂无卡片数据</p></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredCards.map(card => (
              <div key={card.id} onClick={() => setSelectedCard(card)} className="group bg-white rounded-xl overflow-hidden border border-border hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
                <div className="aspect-[3/4] overflow-hidden"><ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full group-hover:scale-105 transition-transform duration-500" /></div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-ink truncate pr-2 flex-1">{card.title}</h3>
                    <Rating value={card.rating} />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {card.tagIds.map(tid => <span key={tid} className="text-[10px] uppercase px-1.5 py-0.5 bg-stone-100 text-subtle rounded">{data.tags.find(t => t.id === tid)?.name}</span>)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400"><Calendar size={10} /><span>{card.startDate}</span>{card.endDate && <span>- {card.endDate}</span>}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal isOpen={!!selectedCard} onClose={() => setSelectedCard(null)} title={selectedCard?.title || ''}>
        {selectedCard && (
          <div className="space-y-4">
            <div className="aspect-video rounded-lg overflow-hidden border border-border"><ImagePreview src={selectedCard.coverUrl} alt={selectedCard.title} /></div>
            <div><label className="text-xs font-bold text-subtle uppercase">时间</label><p className="text-sm text-ink">{selectedCard.startDate} 至 {selectedCard.endDate || '至今'}</p></div>
            <div><label className="text-xs font-bold text-subtle uppercase">评分</label><div className="flex items-center gap-2"><Rating value={selectedCard.rating} /><span className="text-xs font-mono">{selectedCard.rating} / 5</span></div></div>
            <div><label className="text-xs font-bold text-subtle uppercase">简介</label><p className="text-sm text-ink whitespace-pre-wrap leading-relaxed mt-1">{selectedCard.description || '暂无描述信息。'}</p></div>
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
    } else {
      alert('同步失败，请检查 WebDAV 连接或跨域设置。注意：坚果云不支持直接跨域访问，请更换支持 CORS 的 WebDAV 服务商。');
    }
    setSyncing(false);
  };

  if (checking) return <PageLoader />;
  if (!isAuth) return <AdminLogin onLogin={(keep) => {
    setIsAuth(true);
    localStorage.setItem('tat_expiry', (new Date().getTime() + (keep ? 30 : 1) * 24 * 60 * 60 * 1000).toString());
  }} />;

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden">
      <aside className="w-64 bg-white border-r border-border flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink font-bold"><Layout size={20} /><span>后台管理</span></div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavButton to="/tat/cards" icon={<Grid size={18} />} label="卡片管理" />
          <NavButton to="/tat/tags" icon={<Tags size={18} />} label="标签分类" />
          <NavButton to="/tat/settings" icon={<Settings size={18} />} label="网站设置" />
        </nav>
        <div className="p-4 border-t border-border">
          <button onClick={() => { localStorage.removeItem('tat_expiry'); window.location.href = '/'; }} className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"><LogOut size={18} /><span>退出登录</span></button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-border h-16 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-2">
            {hasChanges && <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-100"><AlertCircle size={14} /><span>有未同步的修改</span></div>}
          </div>
          <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" className="h-9 px-4">
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
            <span>同步到云端</span>
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="cards" element={<AdminCards data={localData} onUpdate={(d) => handleDataChange(d)} />} />
            <Route path="tags" element={<AdminTags data={localData} onUpdate={(d) => handleDataChange(d)} />} />
            <Route path="settings" element={<AdminSettings data={localData} onUpdate={(d) => handleDataChange(d)} />} />
            <Route path="*" element={<Navigate to="cards" replace />} />
          </Routes>
        </main>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around p-3 z-40">
        <NavButton to="/tat/cards" icon={<Grid size={20} />} label="" />
        <NavButton to="/tat/tags" icon={<Tags size={20} />} label="" />
        <NavButton to="/tat/settings" icon={<Settings size={20} />} label="" />
        <button onClick={handleSync} className={`p-2 ${hasChanges ? 'text-amber-600' : 'text-stone-300'}`}><CloudUpload size={20} /></button>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to);
  return <button onClick={() => navigate(to)} className={`flex items-center gap-3 px-4 py-2.5 w-full text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-ink text-white' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}>{icon}{label && <span>{label}</span>}</button>;
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
      setError('连接失败，请检查 WebDAV 配置及网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-border p-8">
        <div className="flex justify-center mb-6"><div className="p-3 bg-stone-100 rounded-full"><Lock className="w-6 h-6 text-ink" /></div></div>
        <h2 className="text-xl font-bold text-center text-ink mb-8">管理后台</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="账号" value={username} onChange={e => setUsername(e.target.value)} />
          <Input label="密码" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="flex items-center gap-2"><input type="checkbox" id="keep" checked={keep} onChange={e => setKeep(e.target.checked)} className="rounded border-border text-ink" /><label htmlFor="keep" className="text-sm text-subtle select-none">30天免登录</label></div>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? '验证中...' : '登录'}</Button>
        </form>
      </div>
    </div>
  );
};

// --- Admin Views ---

const AdminCards: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<CardData>>({});

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
    if (!confirm('确定删除吗？')) return;
    onUpdate({ ...data, cards: data.cards.filter(c => c.id !== id) });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-ink">卡片管理</h2><Button onClick={() => { setEditingCard({ tagIds: [], rating: 0, description: '' }); setIsModalOpen(true); }}><Plus size={16} /> 新建卡片</Button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.cards.map(card => (
          <div key={card.id} className="bg-white p-4 rounded-xl border border-border flex gap-4 group">
            <div className="w-16 h-20 bg-stone-100 rounded overflow-hidden flex-shrink-0"><ImagePreview src={card.coverUrl} alt={card.title} /></div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-ink truncate text-sm">{card.title}</h4>
              <div className="flex gap-1 mt-1 truncate">{card.tagIds.map(tid => <span key={tid} className="text-[9px] bg-stone-50 text-subtle border border-border px-1 rounded">{data.tags.find(t=>t.id===tid)?.name}</span>)}</div>
              <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={12} /></button>
                <button onClick={() => handleDelete(card.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCard.id ? "编辑卡片" : "新建卡片"}>
        <div className="space-y-4">
          <Input label="卡片名称" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} />
          <Input label="封面链接" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} />
          <TextArea label="详细信息 / 简介" value={editingCard.description || ''} onChange={e => setEditingCard({...editingCard, description: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="开始日期" type="date" value={editingCard.startDate || ''} onChange={e => setEditingCard({...editingCard, startDate: e.target.value})} />
            <Input label="结束日期" type="date" value={editingCard.endDate || ''} onChange={e => setEditingCard({...editingCard, endDate: e.target.value})} />
          </div>
          <div><label className="text-xs font-semibold text-subtle uppercase block mb-1">评分 ({editingCard.rating})</label><input type="range" min="0" max="5" step="0.5" className="w-full accent-ink" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} /></div>
          <div><label className="text-xs font-semibold text-subtle uppercase block mb-2">所属分类</label><div className="flex flex-wrap gap-2">{data.tags.map(tag => {
            const active = editingCard.tagIds?.includes(tag.id);
            return <button key={tag.id} onClick={() => {
              const ids = editingCard.tagIds || [];
              setEditingCard({...editingCard, tagIds: active ? ids.filter(i => i !== tag.id) : [...ids, tag.id]});
            }} className={`px-2 py-1 text-[10px] rounded border transition-all ${active ? 'bg-ink text-white border-ink' : 'bg-white text-subtle border-border'}`}>{tag.name}</button>
          })}</div></div>
          <Button onClick={handleSave} className="w-full mt-4">暂存更改</Button>
        </div>
      </Modal>
    </div>
  );
};

const AdminTags: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [newTag, setNewTag] = useState('');
  const handleAdd = () => {
    if (!newTag.trim()) return;
    onUpdate({ ...data, tags: [...data.tags, { id: Date.now().toString(), name: newTag }] });
    setNewTag('');
  };
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-ink mb-6">分类管理</h2>
      <div className="flex gap-2 mb-6"><Input placeholder="新分类名称" value={newTag} onChange={e => setNewTag(e.target.value)} /><Button onClick={handleAdd}>添加</Button></div>
      <div className="space-y-2">{data.tags.map(tag => (
        <div key={tag.id} className="flex items-center justify-between p-3 bg-white border border-border rounded-lg"><span className="text-sm font-medium">{tag.name}</span><button onClick={() => onUpdate({ ...data, tags: data.tags.filter(t => t.id !== tag.id) })} className="text-subtle hover:text-red-600 p-1"><Trash2 size={14} /></button></div>
      ))}</div>
    </div>
  );
};

const AdminSettings: React.FC<{ data: PublicData; onUpdate: (d: PublicData) => void }> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [creds, setCreds] = useState({ username: '', password: '' });

  useEffect(() => { webdav.getPrivateData().then(setCreds); }, []);

  return (
    <div className="max-w-xl space-y-8">
      <div><h2 className="text-xl font-bold text-ink mb-4">基本设置</h2><div className="bg-white p-6 rounded-xl border border-border space-y-4">
        <Input label="网站名称" value={siteSettings.title} onChange={e => { const s = {...siteSettings, title: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} />
        <Input label="网站图标 URL" value={siteSettings.iconUrl} onChange={e => { const s = {...siteSettings, iconUrl: e.target.value}; setSiteSettings(s); onUpdate({...data, settings: s}); }} />
      </div></div>
      <div><h2 className="text-xl font-bold text-ink mb-4">管理员账号</h2><div className="bg-white p-6 rounded-xl border border-border space-y-4">
        <Input label="账号" value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} />
        <Input label="新密码" type="password" value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} />
        <Button variant="danger" onClick={async () => { await webdav.savePrivateData(creds); alert('密码已即时更新'); }}>保存账号密码</Button>
      </div></div>
    </div>
  );
};

export default App;