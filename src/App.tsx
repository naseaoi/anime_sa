
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DEFAULT_PUBLIC_DATA } from './domain/publicData';
import { AUTH_CHANGED_EVENT, getStorageAsync, checkServerSession } from './services/storageFactory';
import { PublicData } from './types';
import { ToastProvider, ThemeProvider } from './components/Common';
import { applyThemeColor } from './utils/themeColor';
import { applyPageMetadata } from './utils/seo';
import { PublicHome } from './components/PublicHome';
import { PublicHomeSkeleton } from './components/public/PublicSkeletons';
import { PublicNavigationProvider } from './components/public/PublicNavigationContext';

const PublicDetail = React.lazy(() => import('./components/PublicDetail').then((m) => ({ default: m.PublicDetail })));
const AdminLayout = React.lazy(() => import('./components/Admin').then((m) => ({ default: m.AdminLayout })));
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
  const hasLoadedDataRef = useRef(false);
  
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
    if (!hasLoadedDataRef.current) setLoading(true);
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
      hasLoadedDataRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 全局检测管理员权限
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const refreshAuth = () => { checkServerSession().then(setIsAdmin); };
    refreshAuth();
    window.addEventListener(AUTH_CHANGED_EVENT, refreshAuth);
    window.addEventListener('pageshow', refreshAuth);
    window.addEventListener('focus', refreshAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, refreshAuth);
      window.removeEventListener('pageshow', refreshAuth);
      window.removeEventListener('focus', refreshAuth);
    };
  }, []);

  const getRouteFallback = () => skeletonForPath(window.location.pathname);

  if (loading) return getRouteFallback();

  return (
    <div className="relative min-h-screen isolate">
      <div className="relative z-10">
        <BrowserRouter>
          <PublicNavigationProvider data={data} isAdmin={isAdmin}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/tat/*" element={<AdminLayout initialData={data} refreshData={fetchData} />} />
              <Route path="/" element={<PublicHome data={data} refreshData={fetchData} />} />
              <Route path="/:section" element={<PublicHome data={data} refreshData={fetchData} />} />
              <Route path="/:section/:id" element={<PublicDetail data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="/card/:id" element={<PublicDetail data={data} refreshData={fetchData} isAdmin={isAdmin} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </PublicNavigationProvider>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
