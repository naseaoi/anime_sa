
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicData } from '../types';
import { getStorage, checkServerSession, logoutServerSession } from '../services/storageFactory';
import { migrateEmbeddedCoverAssets } from '../services/coverAssetService';
import { applyThemeColor } from '../utils/themeColor';
import { useToast } from './Common';
import { AdminLogin } from './admin/AdminLogin';
import { AdminCardsSection } from './admin/AdminCardsSection';
import { AdminTagsSection } from './admin/AdminTagsSection';
import { AdminSyncSection } from './admin/AdminSyncSection';
import { AdminSettingsSection } from './admin/AdminSettingsSection';
import { AdminShell } from './admin/layout/AdminShell';
import { useSyncOperations } from './admin/hooks/useSyncOperations';

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
      document.title = `${localData.settings.title} - 管理后台`;
    }
    if (localData.settings.iconUrl) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      if (favicon) favicon.href = localData.settings.iconUrl;
    }
    applyThemeColor(localData.settings.themeColor);
  }, [localData.settings]);

  const handleDataChange = (newData: PublicData) => {
    setLocalData(newData);
    setHasChanges(true);
  };

  const persistData = useCallback(async (nextData: PublicData, successMessage?: string) => {
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
  }, [refreshData, showToast, storageType]);

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
    <AdminShell
      hasChanges={hasChanges}
      syncing={syncing}
      storageType={storageType}
      onSave={handleSync}
      onLogout={async () => {
        await logoutServerSession();
        window.location.href = '/';
      }}
    >
      <Routes>
        <Route path="cards" element={<AdminCardsSection data={localData} onUpdate={(d) => handleDataChange(d)} />} />
        <Route path="tags" element={<AdminTagsSection data={localData} onUpdate={(d) => handleDataChange(d)} />} />
        <Route
          path="sync"
          element={
            <AdminSyncSection
              syncOps={syncOps}
              syncInfoToken={syncInfoToken}
            />
          }
        />
        <Route path="settings" element={<AdminSettingsSection data={localData} onUpdate={(d) => handleDataChange(d)} />} />
        <Route path="*" element={<Navigate to="cards" replace />} />
      </Routes>
    </AdminShell>
  );
};
