
import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DEFAULT_PUBLIC_DATA } from './services/webdavService';
import { getStorageAsync } from './services/storageFactory';
import { PublicData } from './types';
import { PageLoader, ToastProvider, ThemeProvider } from './components/Common';
import { PublicDetail } from './components/PublicDetail';
import { PublicHome } from './components/PublicHome';
import { AdminLayout } from './components/Admin';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainRouter />
      </ToastProvider>
    </ThemeProvider>
  );
};

const MainRouter: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  // 初始化时尝试从缓存读取设置，避免 React 水合时的闪烁
  const [data, setData] = useState<PublicData>(() => {
    try {
      const cached = localStorage.getItem('tat_site_settings');
      if (cached) {
        return { ...DEFAULT_PUBLIC_DATA, settings: JSON.parse(cached) };
      }
    } catch (e) {}
    return DEFAULT_PUBLIC_DATA;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    // 异步获取服务端配置的存储模式，确保访客读取正确的数据源
    const storage = await getStorageAsync();
    const result = await storage.getPublicData();
    setData(result);
    // 缓存最新设置到本地
    localStorage.setItem('tat_site_settings', JSON.stringify(result.settings));
    
    // 更新当前页面标题
    if (result.settings.title) document.title = result.settings.title;
    if (result.settings.iconUrl) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) favicon.href = result.settings.iconUrl;
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 全局检测管理员权限
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const expiry = localStorage.getItem('tat_expiry');
    if (expiry && new Date().getTime() < parseInt(expiry)) setIsAdmin(true);
  }, []);

  if (loading) return <PageLoader />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHome data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
        <Route path="/card/:id" element={<PublicDetail data={data} refreshData={fetchData} />} />
        <Route path="/tat/*" element={<AdminLayout initialData={data} refreshData={fetchData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
