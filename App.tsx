import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Plus, Edit2, Trash2, Calendar, Lock, Loader2 } from 'lucide-react';
import { webdav, DEFAULT_PUBLIC_DATA } from './services/webdavService';
import { PublicData, CardData, Tag, LoginStatus } from './types';
import { Button, Input, Modal, PageLoader, ImagePreview, Rating } from './components/Common';

// --- Context & State ---

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PublicData>(DEFAULT_PUBLIC_DATA);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await webdav.getPublicData();
    setData(result);
    // Update document head
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
        <Route path="/tat/*" element={<AdminLayout data={data} refreshData={fetchData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

// --- Public View ---

const PublicHome: React.FC<{ data: PublicData }> = ({ data }) => {
  const [activeTag, setActiveTag] = useState<string>('all');

  const filteredCards = activeTag === 'all' 
    ? data.cards 
    : data.cards.filter(c => c.tagIds.includes(activeTag));

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={data.settings.iconUrl} alt="Logo" className="w-8 h-8 rounded-full bg-stone-100 object-cover" />
            <h1 className="font-bold text-ink text-lg tracking-tight">{data.settings.title}</h1>
          </div>
          {/* Tag Filter (Desktop) */}
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeTag === activeTag ? 'hover:bg-stone-100' : ''} ${activeTag === tag.id ? 'bg-ink text-white' : 'text-subtle'}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
        {/* Mobile Filter */}
        <div className="sm:hidden overflow-x-auto px-4 py-2 flex gap-2 no-scrollbar border-t border-border bg-white">
           <button 
              onClick={() => setActiveTag('all')}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${activeTag === 'all' ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}
            >
              全部
            </button>
            {data.tags.map(tag => (
              <button 
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border ${activeTag === tag.id ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}
              >
                {tag.name}
              </button>
            ))}
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-subtle">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
              <Grid className="w-8 h-8 opacity-20" />
            </div>
            <p>暂无内容</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredCards.map(card => (
              <div key={card.id} className="group bg-white rounded-xl overflow-hidden border border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="aspect-[3/4] overflow-hidden">
                  <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-ink truncate pr-2 flex-1">{card.title}</h3>
                    <Rating value={card.rating} />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {card.tagIds.map(tid => {
                      const t = data.tags.find(tag => tag.id === tid);
                      if (!t) return null;
                      return <span key={tid} className="text-[10px] uppercase px-1.5 py-0.5 bg-stone-100 text-subtle rounded">{t.name}</span>
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Calendar className="w-3 h-3" />
                    <span>{card.startDate}</span>
                    {card.endDate && <span>- {card.endDate}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// --- Admin Section ---

const AdminLayout: React.FC<{ data: PublicData; refreshData: () => Promise<void> }> = ({ data, refreshData }) => {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Check local storage for session
    const expiry = localStorage.getItem('tat_expiry');
    if (expiry && new Date().getTime() < parseInt(expiry)) {
      setIsAuth(true);
    }
    setChecking(false);
  }, []);

  const handleLogin = (keep: boolean) => {
    setIsAuth(true);
    if (keep) {
      // 30 days
      localStorage.setItem('tat_expiry', (new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toString());
    } else {
      // Session only (managed by memory state, but let's set a short expiry for safety if refreshed)
      localStorage.setItem('tat_expiry', (new Date().getTime() + 24 * 60 * 60 * 1000).toString());
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tat_expiry');
    setIsAuth(false);
  };

  if (checking) return <div className="h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-subtle" /></div>;

  if (!isAuth) return <AdminLogin onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-stone-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-border flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 text-ink font-bold">
            <Layout className="w-5 h-5" />
            <span>后台管理</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavButton to="/tat/cards" icon={<Grid size={18} />} label="卡片管理" />
          <NavButton to="/tat/tags" icon={<Tags size={18} />} label="标签分类" />
          <NavButton to="/tat/settings" icon={<Settings size={18} />} label="网站设置" />
        </nav>
        <div className="p-4 border-t border-border">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={18} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* Mobile Nav (Bottom) - simplified for demo */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around p-3 z-40">
        <NavButton to="/tat/cards" icon={<Grid size={20} />} label="" />
        <NavButton to="/tat/tags" icon={<Tags size={20} />} label="" />
        <NavButton to="/tat/settings" icon={<Settings size={20} />} label="" />
        <button onClick={handleLogout} className="p-2 text-red-600"><LogOut size={20} /></button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <Routes>
          <Route path="cards" element={<AdminCards data={data} onUpdate={refreshData} />} />
          <Route path="tags" element={<AdminTags data={data} onUpdate={refreshData} />} />
          <Route path="settings" element={<AdminSettings data={data} onUpdate={refreshData} />} />
          <Route path="*" element={<Navigate to="cards" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const NavButton: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname.includes(to);
  
  return (
      <button 
        onClick={() => navigate(to)}
        className={`flex items-center gap-3 px-4 py-2.5 w-full text-sm font-medium rounded-lg transition-colors ${isActive ? 'bg-ink text-white' : 'text-subtle hover:bg-stone-100 hover:text-ink'}`}
      >
        {icon}
        {label && <span>{label}</span>}
      </button>
  );
}

// --- Admin Login ---

const AdminLogin: React.FC<{ onLogin: (keep: boolean) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Verify against private_data.json
    try {
      const secrets = await webdav.getPrivateData();
      if (username === secrets.username && password === secrets.password) {
        onLogin(keep);
      } else {
        setError('账号或密码错误');
      }
    } catch (err) {
      setError('验证失败，请检查网络或WebDAV配置');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-border p-8">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-stone-100 rounded-full">
            <Lock className="w-6 h-6 text-ink" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center text-ink mb-8">管理员登录</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="账号" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            placeholder="Admin username"
          />
          <Input 
            label="密码" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="••••••"
          />
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="keep" 
              checked={keep} 
              onChange={e => setKeep(e.target.checked)}
              className="rounded border-border text-ink focus:ring-ink" 
            />
            <label htmlFor="keep" className="text-sm text-subtle select-none">30天免登录</label>
          </div>
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '验证中...' : '进入后台'}
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- Admin Sub-pages ---

const AdminCards: React.FC<{ data: PublicData; onUpdate: () => Promise<void> }> = ({ data, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<CardData>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newCards = [...data.cards];
      if (editingCard.id) {
        // Update
        const idx = newCards.findIndex(c => c.id === editingCard.id);
        if (idx !== -1) newCards[idx] = editingCard as CardData;
      } else {
        // Add
        newCards.push({ ...editingCard, id: Date.now().toString() } as CardData);
      }
      await webdav.savePublicData({ ...data, cards: newCards });
      await onUpdate();
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此卡片吗？')) return;
    const newCards = data.cards.filter(c => c.id !== id);
    await webdav.savePublicData({ ...data, cards: newCards });
    await onUpdate();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-ink">卡片列表</h2>
        <Button onClick={() => { setEditingCard({ tagIds: [], rating: 0 }); setIsModalOpen(true); }} className="flex items-center gap-2">
          <Plus size={16} /> 新建卡片
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.cards.map(card => (
          <div key={card.id} className="bg-white p-4 rounded-xl border border-border flex gap-4">
            <div className="w-20 h-24 flex-shrink-0 bg-stone-100 rounded overflow-hidden">
               <ImagePreview src={card.coverUrl} alt={card.title} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-ink truncate">{card.title}</h4>
              <div className="flex gap-1 mt-1 mb-2">
                 {card.tagIds.map(tid => (
                   <span key={tid} className="text-[10px] bg-stone-100 px-1 rounded">{data.tags.find(t=>t.id===tid)?.name}</span>
                 ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setEditingCard(card); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(card.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCard.id ? "编辑卡片" : "新建卡片"}>
        <div className="space-y-4">
          <Input label="标题" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} />
          <Input label="封面链接" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="开始日期" type="date" value={editingCard.startDate || ''} onChange={e => setEditingCard({...editingCard, startDate: e.target.value})} />
            <Input label="结束日期" type="date" value={editingCard.endDate || ''} onChange={e => setEditingCard({...editingCard, endDate: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-semibold text-subtle uppercase tracking-wider mb-2 block">评分 (0-5)</label>
            <input type="range" min="0" max="5" step="0.5" className="w-full" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} />
            <div className="text-center font-mono text-sm">{editingCard.rating}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-subtle uppercase tracking-wider mb-2 block">分类</label>
            <div className="flex flex-wrap gap-2">
              {data.tags.map(tag => {
                const isActive = editingCard.tagIds?.includes(tag.id);
                return (
                  <button 
                    key={tag.id}
                    onClick={() => {
                      const ids = editingCard.tagIds || [];
                      setEditingCard({
                        ...editingCard, 
                        tagIds: isActive ? ids.filter(i => i !== tag.id) : [...ids, tag.id]
                      });
                    }}
                    className={`px-3 py-1 text-xs rounded-full border ${isActive ? 'bg-ink text-white border-ink' : 'text-subtle border-border'}`}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full mt-4">{saving ? '保存中...' : '保存'}</Button>
        </div>
      </Modal>
    </div>
  );
};

const AdminTags: React.FC<{ data: PublicData; onUpdate: () => Promise<void> }> = ({ data, onUpdate }) => {
  const [newTag, setNewTag] = useState('');
  
  const handleAdd = async () => {
    if (!newTag.trim()) return;
    const updatedTags = [...data.tags, { id: Date.now().toString(), name: newTag }];
    await webdav.savePublicData({ ...data, tags: updatedTags });
    setNewTag('');
    await onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('删除分类会影响已关联的卡片，确定吗？')) return;
    const updatedTags = data.tags.filter(t => t.id !== id);
    await webdav.savePublicData({ ...data, tags: updatedTags });
    await onUpdate();
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-ink mb-6">标签分类</h2>
      <div className="flex gap-2 mb-6">
        <Input placeholder="输入新分类名称" value={newTag} onChange={e => setNewTag(e.target.value)} />
        <Button onClick={handleAdd}>添加</Button>
      </div>
      <div className="space-y-2">
        {data.tags.map(tag => (
          <div key={tag.id} className="flex items-center justify-between p-3 bg-white border border-border rounded-lg">
             <span className="font-medium text-ink">{tag.name}</span>
             <button onClick={() => handleDelete(tag.id)} className="text-subtle hover:text-red-600 p-2"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminSettings: React.FC<{ data: PublicData; onUpdate: () => Promise<void> }> = ({ data, onUpdate }) => {
  const [siteSettings, setSiteSettings] = useState(data.settings);
  const [adminCreds, setAdminCreds] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    webdav.getPrivateData().then(d => setAdminCreds(d));
  }, []);

  const handleSavePublic = async () => {
    setLoading(true);
    await webdav.savePublicData({ ...data, settings: siteSettings });
    await onUpdate();
    setLoading(false);
  };

  const handleSavePrivate = async () => {
    if (!adminCreds.username || !adminCreds.password) return alert("账号密码不能为空");
    setLoading(true);
    await webdav.savePrivateData(adminCreds);
    setLoading(false);
    alert('管理员账号已更新');
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-bold text-ink mb-4">基本设置</h2>
        <div className="bg-white p-6 rounded-xl border border-border space-y-4">
          <Input label="网站标题" value={siteSettings.title} onChange={e => setSiteSettings({...siteSettings, title: e.target.value})} />
          <Input label="Icon URL" value={siteSettings.iconUrl} onChange={e => setSiteSettings({...siteSettings, iconUrl: e.target.value})} />
          <div className="flex items-center gap-4 mt-2">
             <img src={siteSettings.iconUrl} className="w-8 h-8 rounded-full border border-border" alt="preview"/>
             <span className="text-xs text-subtle">预览图标</span>
          </div>
          <Button onClick={handleSavePublic} disabled={loading} className="mt-4">保存设置</Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-ink mb-4">安全设置</h2>
        <div className="bg-white p-6 rounded-xl border border-border space-y-4">
           <Input label="管理员账号" value={adminCreds.username} onChange={e => setAdminCreds({...adminCreds, username: e.target.value})} />
           <Input label="新密码" type="password" value={adminCreds.password} onChange={e => setAdminCreds({...adminCreds, password: e.target.value})} />
           <Button variant="danger" onClick={handleSavePrivate} disabled={loading} className="mt-4">更新密码</Button>
        </div>
      </div>
    </div>
  );
};

export default App;