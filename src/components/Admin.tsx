
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Redirect, Route, Switch } from '../router';
import { PublicData } from '../types';
import { getStorage, checkServerSession, logoutServerSession } from '../services/storageFactory';
import { applyThemeColor } from '../utils/themeColor';
import { applyPageMetadata } from '../utils/seo';
import { useToast } from './Common';
import { AdminLogin } from './admin/AdminLogin';
import { AdminCardsSection } from './admin/AdminCardsSection';
import { AdminTagsSection } from './admin/AdminTagsSection';
import { AdminSyncSection } from './admin/AdminSyncSection';
import { AdminSettingsSection } from './admin/AdminSettingsSection';
import { AdminShell } from './admin/layout/AdminShell';
import { useSyncOperations } from './admin/hooks/useSyncOperations';
import { clearCardDrafts } from '../utils/cardDraft';
import { isPersisted, PersistenceResult, stagedResult } from '../domain/persistence';
import { commitWorkspaceMutation, refreshAfterCommit } from '../services/publicDataMutationService';
import { writeCachedSiteSettings } from '../utils/browserState';

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
  const [syncInfoToken, setSyncInfoToken] = useState(0);
  const { showToast } = useToast();
  const storageType = getStorage().type;

  const localDataRef = useRef(localData);
  const dirtyCardIdsRef = useRef(new Set<string>());
  localDataRef.current = localData;

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

  useEffect(() => {
    if (localData.settings.title) {
      applyPageMetadata(`${localData.settings.title} - 管理后台`, '站点管理入口。', false);
    }
    if (localData.settings.iconUrl) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) favicon.href = localData.settings.iconUrl;
    }
    applyThemeColor(localData.settings.themeColor);
  }, [localData.settings]);

  const handleDataChange = (newData: PublicData, changedCardId?: string) => {
    if (changedCardId) dirtyCardIdsRef.current.add(changedCardId);
    setLocalData(newData);
    setHasChanges(true);
    return stagedResult();
  };

  const persistData = useCallback(async (nextData: PublicData, successMessage?: string): Promise<PersistenceResult> => {
    const result = await commitWorkspaceMutation(nextData, dirtyCardIdsRef.current);
    if (!isPersisted(result)) {
      const prefix = result.state === 'conflict' ? '数据已更新' : '保存失败';
      showToast(`${prefix}: ${result.error}`, 'error');
      return result;
    }

    const committedData = result.data;
    clearCardDrafts(window.localStorage, [...initialData.cards, ...committedData.cards], true, 'admin');
    dirtyCardIdsRef.current.clear();
    setLocalData(committedData);
    setHasChanges(false);
    writeCachedSiteSettings(committedData.settings);
    const refreshed = await refreshAfterCommit(refreshData);
    showToast(
      refreshed
        ? (successMessage || (result.migrated ? `保存成功，并迁移 ${result.migrated} 张本地封面` : '已保存更改'))
        : '保存成功，但页面刷新失败',
      refreshed ? 'success' : 'info'
    );
    return result;
  }, [initialData.cards, refreshData, showToast]);

  const syncOps = useSyncOperations({
    getData: useCallback(() => localDataRef.current, []),
    onPersistData: useCallback(async (nextData: PublicData, successMessage: string) => {
      setSyncing(true);
      try {
        return await persistData(nextData, successMessage);
      } finally {
        setSyncing(false);
      }
    }, [persistData]),
    showToast,
    reloadInfo: useCallback(() => setSyncInfoToken((n) => n + 1), [])
  });

  const handlePersist = async () => {
    setSyncing(true);
    try {
      const result = await persistData(localData);
      if (!isPersisted(result)) {
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
    <AdminShell
      hasChanges={hasChanges}
      syncing={syncing}
      storageType={storageType}
      onPersist={handlePersist}
      onLogout={async () => {
        await logoutServerSession();
        window.location.href = '/';
      }}
    >
      <Switch>
        <Route path="/tat/cards"><AdminCardsSection data={localData} onUpdate={handleDataChange} /></Route>
        <Route path="/tat/tags"><AdminTagsSection data={localData} onUpdate={(d) => handleDataChange(d)} /></Route>
        <Route path="/tat/sync">
          <AdminSyncSection
            syncOps={syncOps}
            syncInfoToken={syncInfoToken}
          />
        </Route>
        <Route path="/tat/settings"><AdminSettingsSection data={localData} onUpdate={(d) => handleDataChange(d)} /></Route>
        <Route><Redirect to="/tat/cards" replace /></Route>
      </Switch>
    </AdminShell>
  );
};
