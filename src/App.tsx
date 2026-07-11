
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DEFAULT_PUBLIC_DATA } from './domain/publicData';
import { getStorageAsync, checkServerSession } from './services/storageFactory';
import { PublicData } from './types';
import { ToastProvider, ThemeProvider } from './components/Common';
import { applyThemeColor } from './utils/themeColor';
import { applyPageMetadata } from './utils/seo';
import { PublicHome } from './components/PublicHome';
import { PublicHomeSkeleton } from './components/public/PublicSkeletons';

const PublicDetail = React.lazy(() => import('./components/PublicDetail').then((m) => ({ default: m.PublicDetail })));
const AdminLayout = React.lazy(() => import('./components/Admin').then((m) => ({ default: m.AdminLayout })));
const LOADING_UNDERLAY_MS = 420;

const skeletonForPath = (pathname: string): React.ReactElement | null => {
  if (pathname.startsWith('/tat')) return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) return null;
  return <PublicHomeSkeleton />;
};

const RouteFallback: React.FC = () => {
  const { pathname } = useLocation();
  return skeletonForPath(pathname);
};

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
  
  // 本地站点设置
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
      const storage = await getStorageAsync();
      const result = await storage.getPublicData();
      setData(result);

      // 缓存最新设置到本地
      localStorage.setItem('tat_site_settings', JSON.stringify(result.settings));

      applyThemeColor(result.settings.themeColor);

      if (result.settings.title) applyPageMetadata(result.settings.title);
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

  const getRouteFallback = () => skeletonForPath(window.location.pathname);

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
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/tat/*" element={<AdminLayout initialData={data} refreshData={fetchData} />} />
              <Route path="/" element={<PublicHome data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="/:section" element={<PublicHome data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="/:section/:id" element={<PublicDetail data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="/card/:id" element={<PublicDetail data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
