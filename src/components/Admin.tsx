
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, Settings, Tags, Grid, LogOut, Loader2, CloudUpload, AlertCircle, X, Home, Menu, Database, RefreshCw } from 'lucide-react';
import { PublicData } from '../types';
import { getStorage, checkServerSession, logoutServerSession } from '../services/storageFactory';
import { migrateEmbeddedCoverAssets } from '../services/coverAssetService';
import { Button, useToast } from './Common';
import { AdminNavButton } from './admin/AdminNavButton';
import { AdminLogin } from './admin/AdminLogin';
import { AdminCardsSection } from './admin/AdminCardsSection';
import { AdminTagsSection } from './admin/AdminTagsSection';
import { AdminSyncSection } from './admin/AdminSyncSection';
import { AdminSettingsSection } from './admin/AdminSettingsSection';

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
    let mounted = true;
    checkServerSession().then((ok) => {
      if (!mounted) return;
      setIsAuth(ok);
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
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

  const persistData = async (nextData: PublicData, successMessage?: string) => {
    const storage = getStorage();
    const dataToSave = { ...nextData, updatedAt: Date.now() };
    const result = await storage.savePublicData(dataToSave);
    if (!result.success) {
      showToast(`${storageType === 'sqlite' ? '保存' : '同步'}失败: ${result.error}`, 'error');
      return false;
    }

    setLocalData(dataToSave);
    await refreshData();
    localStorage.setItem('tat_site_settings', JSON.stringify(dataToSave.settings));
    setHasChanges(false);
    showToast(successMessage || (storageType === 'sqlite' ? '已保存更改' : '数据同步成功'), 'success');
    return true;
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const migrated = await migrateEmbeddedCoverAssets(localData.cards);
      const success = await persistData(
        { ...localData, cards: migrated.cards },
        migrated.migrated > 0
          ? `保存成功，并迁移 ${migrated.migrated} 张本地封面`
          : undefined
      );
      if (!success) {
        return;
      }
    } finally {
      setSyncing(false);
    }
  };

  if (checking) return null;
  if (!isAuth) return <AdminLogin onLogin={() => {
    setIsAuth(true);
  }} />;

  return (
    <div className="flex h-screen overflow-hidden font-sans transition-colors duration-300">
      {/* 移动端侧边栏遮罩 */}
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* 侧边栏 */}
    <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-[color:var(--surface-muted)] border-r border-[color:var(--line)] backdrop-blur-xl flex flex-col z-40 fixed inset-y-0 left-0 transform transition-all duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-20 border-b border-[color:var(--line)] flex items-center justify-between px-4 gap-3 overflow-hidden">
          <div className="relative h-8 flex-1 cursor-pointer" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <div
              className={`absolute top-0 w-8 h-8 bg-[color:var(--text-primary)] rounded-lg flex items-center justify-center text-[color:var(--surface)] transition-[left,transform] ease-in-out ${sidebarCollapsed ? 'left-1/2 -translate-x-1/2' : 'left-0 translate-x-0'}`}
              style={{ transitionDuration: sidebarCollapsed ? '280ms' : '560ms' }}
            ><Layout size={18} /></div>
            <span className={`absolute left-12 top-1/2 -translate-y-1/2 font-bold text-[color:var(--text-primary)] text-lg whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[140px] opacity-100 translate-x-0'}`}>后台管理</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className={`md:hidden text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-opacity ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><X size={20} /></button>
        </div>
        <div className="p-4 flex-1">
           <nav className="space-y-2">
             <div onClick={() => setMobileMenuOpen(false)}><AdminNavButton to="/tat/cards" icon={<Grid size={20} />} label="卡片管理" count={localData.cards.length} collapsed={sidebarCollapsed} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><AdminNavButton to="/tat/tags" icon={<Tags size={20} />} label="分类管理" count={localData.tags.length} collapsed={sidebarCollapsed} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><AdminNavButton to="/tat/sync" icon={<RefreshCw size={20} />} label="数据同步" collapsed={sidebarCollapsed} /></div>
             <div onClick={() => setMobileMenuOpen(false)}><AdminNavButton to="/tat/settings" icon={<Settings size={20} />} label="网站设置" collapsed={sidebarCollapsed} /></div>
            </nav>
         </div>
        <div className="p-4 border-t border-[color:var(--line)] flex flex-col gap-2">
          {/* 修改：移除外层 div 的 onClick 强制刷新，NavButton 内部已处理路由跳转 */}
          <div><AdminNavButton to="/" icon={<Home size={20} />} label="返回首页" collapsed={sidebarCollapsed} /></div>
          <button onClick={async () => { await logoutServerSession(); window.location.href = '/'; }} className="flex items-center gap-3 px-3 py-3 w-full text-base font-bold text-red-500 hover:bg-red-50/70 rounded-xl border border-transparent hover:border-red-100 transition-all overflow-hidden">
            <span className="w-5 h-5 shrink-0 flex items-center justify-center"><LogOut size={20} /></span>
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'max-w-0 opacity-0 -translate-x-1' : 'max-w-[120px] opacity-100 translate-x-0'}`}>退出登录</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-[color:var(--surface-muted)] border-b border-[color:var(--line)] h-20 flex items-center justify-between px-6 sm:px-8 z-10 sticky top-0 backdrop-blur-xl transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-[color:var(--text-secondary)] hover:bg-[color:var(--accent-soft)] rounded-lg"><Menu size={20} /></button>
            <h2 className="text-lg font-bold text-[color:var(--text-primary)]">
              {location.pathname.includes('cards') ? '卡片档案' : 
               location.pathname.includes('tags') ? '分类配置' : 
               location.pathname.includes('sync') ? '数据同步' : '系统参数'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {hasChanges && <div className="hidden sm:flex items-center gap-2 text-amber-700 dark:text-amber-400 bg-[color:var(--accent-soft)] px-4 py-2 rounded-lg text-xs font-bold border border-amber-200/50 dark:border-amber-900/30"><AlertCircle size={14} /><span>有待同步的修改</span></div>}
            <Button onClick={handleSync} disabled={!hasChanges || syncing} variant="success" size="md" className="rounded-xl h-10 px-5">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : (storageType === 'sqlite' ? <Database size={16} /> : <CloudUpload size={16} />)}
              <span>{syncing ? (storageType === 'sqlite' ? '保存中' : '同步中') : (storageType === 'sqlite' ? '保存更改' : '同步云端')}</span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto scrollbar-stable scrollbar-thinest p-4 sm:p-6 lg:p-10"><div className="max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="cards" element={<AdminCardsSection data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="tags" element={<AdminTagsSection data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route
                path="sync"
                element={
                  <AdminSyncSection
                    data={localData}
                    onPersistData={async (nextData, successMessage) => {
                      setSyncing(true);
                      try {
                        return await persistData(nextData, successMessage);
                      } finally {
                        setSyncing(false);
                      }
                    }}
                  />
                }
              />
              <Route path="settings" element={<AdminSettingsSection data={localData} onUpdate={(d) => handleDataChange(d)} />} />
              <Route path="*" element={<Navigate to="cards" replace />} />
            </Routes>
          </div></main>
      </div>
    </div>
  );
};
