
import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { isAdminRoutePath, Redirect, Route, Router, Switch, useLocation } from './router';
import { DEFAULT_PUBLIC_DATA } from './domain/publicData';
import {
  AUTH_CHANGED_EVENT,
  checkServerSession,
  fetchStorageDriver,
  getStorage,
  getStorageRuntimeState
} from './services/storageFactory';
import { PublicData } from './types';
import { ToastProvider, ThemeProvider } from './components/Common';
import { applyThemeColor } from './utils/themeColor';
import { applyPageMetadata } from './utils/seo';
import { PublicHome } from './components/PublicHome';
import { PublicHomeSkeleton } from './components/public/PublicSkeletons';
import { PublicNavigationProvider } from './components/public/PublicNavigationContext';
import { errorMessage } from './services/apiClient';
import { readCachedSiteSettings, writeCachedSiteSettings } from './utils/browserState';

const PublicDetail = React.lazy(() => import('./components/PublicDetail').then((m) => ({ default: m.PublicDetail })));
const AdminLayout = React.lazy(() => import('./components/Admin').then((m) => ({ default: m.AdminLayout })));
const skeletonForPath = (pathname: string): React.ReactElement | null => {
  if (isAdminRoutePath(pathname)) return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) return null;
  return <PublicHomeSkeleton />;
};

const RouteFallback: React.FC = () => {
  const { pathname } = useLocation();
  return skeletonForPath(pathname);
};

const AdminRoute: React.FC<{
  initialData: PublicData;
  refreshData: () => Promise<void>;
}> = ({ initialData, refreshData }) => {
  const [ready, setReady] = useState(() => getStorageRuntimeState().status === 'ready');
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setError(null);
    try {
      await fetchStorageDriver();
      setReady(true);
    } catch (cause) {
      setError(errorMessage(cause, '无法读取存储驱动'));
    }
  }, []);

  useEffect(() => {
    if (!ready) void initialize();
  }, [initialize, ready]);

  if (error) return <DataLoadError message={error} onRetry={() => void initialize()} />;
  if (!ready) return null;
  return <AdminLayout initialData={initialData} refreshData={refreshData} />;
};

const DataLoadError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <main className="flex min-h-screen items-center justify-center bg-[color:var(--bg-soft)] p-6">
    <section className="w-full max-w-md rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-[color:var(--text-primary)]">数据加载失败</h1>
      <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{message}</p>
      <button type="button" onClick={onRetry} className="mt-5 rounded-[6px] bg-[color:var(--text-primary)] px-4 py-2 text-sm font-medium text-[color:var(--surface)]">
        重试
      </button>
    </section>
  </main>
);

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasLoadedDataRef = useRef(false);
  const loadErrorRef = useRef<string | null>(null);
  
  // 本地站点设置
  const [data, setData] = useState<PublicData>(() => {
    const settings = readCachedSiteSettings();
    if (settings) return { ...DEFAULT_PUBLIC_DATA, settings };
    return DEFAULT_PUBLIC_DATA;
  });

  const fetchData = useCallback(async () => {
    if (!hasLoadedDataRef.current || loadErrorRef.current) setLoading(true);
    loadErrorRef.current = null;
    setLoadError(null);
    try {
      const storage = getStorage();
      const result = await storage.getPublicData();
      setData(result);
      hasLoadedDataRef.current = true;

      // 缓存最新设置到本地
      writeCachedSiteSettings(result.settings);

      applyThemeColor(result.settings.themeColor);

      if (result.settings.title) applyPageMetadata(result.settings.title);
      if (result.settings.iconUrl) {
        const favicon = document.getElementById('favicon') as HTMLLinkElement;
        if (favicon) favicon.href = result.settings.iconUrl;
      }
    } catch (error) {
      const message = errorMessage(error, '无法读取站点数据');
      console.error('App fetchData error:', error);
      if (!hasLoadedDataRef.current) {
        loadErrorRef.current = message;
        setLoadError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (isAdminRoutePath(window.location.pathname)) {
      void fetchStorageDriver().catch(() => {});
    }
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
  if (loadError) return <DataLoadError message={loadError} onRetry={() => void fetchData()} />;

  return (
    <div className="relative min-h-screen isolate">
      <div className="relative z-10">
        <Router>
          <PublicNavigationProvider data={data} isAdmin={isAdmin}>
          <Suspense fallback={<RouteFallback />}>
            <Switch>
              <Route path={/^\/tat(?:\/.*)?\/?$/}><AdminRoute initialData={data} refreshData={fetchData} /></Route>
              <Route path="/"><PublicHome data={data} refreshData={fetchData} /></Route>
              <Route path="/:section"><PublicHome data={data} refreshData={fetchData} /></Route>
              <Route path="/:section/:id"><PublicDetail data={data} refreshData={fetchData} isAdmin={isAdmin} /></Route>
              <Route><Redirect to="/" replace /></Route>
            </Switch>
          </Suspense>
          </PublicNavigationProvider>
        </Router>
      </div>
    </div>
  );
}

export default App;
