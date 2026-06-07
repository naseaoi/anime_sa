
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicData } from '../types';
import { getStorage, checkServerSession, logoutServerSession } from '../services/storageFactory';
import { migrateEmbeddedCoverAssets } from '../services/coverAssetService';
import { useToast } from './Common';
import { AdminLogin } from './admin/AdminLogin';
import { AdminCardsSection } from './admin/AdminCardsSection';
import { AdminTagsSection } from './admin/AdminTagsSection';
import { AdminSyncSection } from './admin/AdminSyncSection';
import { AdminSettingsSection } from './admin/AdminSettingsSection';
import { AdminShell } from './admin/layout/AdminShell';

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
    <AdminShell
      data={localData}
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
    </AdminShell>
  );
};
