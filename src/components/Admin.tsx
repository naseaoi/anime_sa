
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicData } from '../types';
import { getStorage, checkServerSession, logoutServerSession } from '../services/storageFactory';
import { migrateEmbeddedCoverAssets } from '../services/coverAssetService';
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
import { persistCardCover } from '../services/coverAssetService';
import { clearCardDrafts } from '../utils/cardDraft';

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
  };

  const persistData = useCallback(async (nextData: PublicData, successMessage?: string) => {
    try {
      const storage = getStorage();
      const expectedUpdatedAt = Number(nextData.updatedAt || 0);
      const migrated = await migrateEmbeddedCoverAssets(nextData.cards);
      const preparedCards = [];
      for (const card of migrated.cards) {
        preparedCards.push(
          dirtyCardIdsRef.current.has(card.id) ? await persistCardCover(card) : card
        );
      }

      const dataToSave = { ...nextData, cards: preparedCards, updatedAt: Date.now() };
      const result = await storage.savePublicData(dataToSave, { expectedUpdatedAt });
      if (!result.success) {
        const prefix = result.conflict ? '数据已更新' : '保存失败';
        showToast(`${prefix}: ${result.error}`, 'error');
        return false;
      }

      clearCardDrafts(window.localStorage, [...initialData.cards, ...dataToSave.cards], true, 'admin');
      dirtyCardIdsRef.current.clear();
      setLocalData(dataToSave);
      await refreshData();
      localStorage.setItem('tat_site_settings', JSON.stringify(dataToSave.settings));
      setHasChanges(false);
      showToast(
        successMessage || (migrated.migrated > 0 ? `保存成功，并迁移 ${migrated.migrated} 张本地封面` : '已保存更改'),
        'success'
      );
      return true;
    } catch (error: any) {
      showToast(`保存失败: ${error?.message || '未知错误'}`, 'error');
      return false;
    }
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const success = await persistData(localData);
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
        <Route path="cards" element={<AdminCardsSection data={localData} onUpdate={handleDataChange} />} />
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
