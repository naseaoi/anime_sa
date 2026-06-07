
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DEFAULT_PUBLIC_DATA } from './services/webdavService';
import { getStorageAsync, checkServerSession } from './services/storageFactory';
import { PublicData } from './types';
import { ToastProvider, ThemeProvider } from './components/Common';
import { PublicHome } from './components/PublicHome';
import { PublicDetailSkeleton, PublicHomeSkeleton } from './components/public/PublicSkeletons';

const PublicDetail = React.lazy(() => import('./components/PublicDetail').then((m) => ({ default: m.PublicDetail })));
const AdminLayout = React.lazy(() => import('./components/Admin').then((m) => ({ default: m.AdminLayout })));
const LOADING_UNDERLAY_MS = 420;

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
  const [showLoadingUnderlay, setShowLoadingUnderlay] = useState(false);
  
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
    setShowLoadingUnderlay(false);
    try {
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
    } catch (e) {
      console.error('App fetchData error:', e);
    } finally {
      setShowLoadingUnderlay(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!showLoadingUnderlay) return;
    const timer = window.setTimeout(() => setShowLoadingUnderlay(false), LOADING_UNDERLAY_MS);
    return () => window.clearTimeout(timer);
  }, [showLoadingUnderlay]);

  // 全局检测管理员权限
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    checkServerSession().then(setIsAdmin);
  }, []);

  const getRouteFallback = () => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/tat')) return null;

    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'card' && segments.length >= 2) return <PublicDetailSkeleton />;
    if (segments.length >= 2) return <PublicDetailSkeleton />;
    return <PublicHomeSkeleton />;
  };

  if (loading) return getRouteFallback();

  const loadingUnderlay = showLoadingUnderlay ? getRouteFallback() : null;

  return (
    <div className="relative min-h-screen isolate">
      {loadingUnderlay && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          {loadingUnderlay}
        </div>
      )}
      <div className={`relative z-10 ${loadingUnderlay ? 'card-fade-in' : ''}`}>
        <BrowserRouter>
          <Suspense fallback={getRouteFallback()}>
            <Routes>
              <Route path="/tat/*" element={<AdminLayout initialData={data} refreshData={fetchData} />} />
              <Route path="/" element={<PublicHome data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="/:section" element={<PublicHome data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="/:section/:id" element={<PublicDetail data={data} refreshData={fetchData} />} />
              <Route path="/card/:id" element={<PublicDetail data={data} refreshData={fetchData} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
