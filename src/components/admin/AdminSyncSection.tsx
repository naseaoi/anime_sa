import React, { useEffect, useState } from 'react';
import { ChevronRight, CloudUpload, Database, Loader2 } from 'lucide-react';
import { getStorage, logoutServerSession, setServerStorageMode, sqliteAdapter, webdavAdapter } from '../../services/storageFactory';
import { AdminCard, Button, ConfirmModal, useToast } from '../Common';

export const AdminSyncSection: React.FC = () => {
  const [currentMode] = useState<'webdav' | 'sqlite'>(getStorage().type);
  const [migrating, setMigrating] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ webdav?: number; sqlite?: number } | null>(null);
  const [syncConfirm, setSyncConfirm] = useState<{ isOpen: boolean; direction: 'to_sqlite' | 'to_webdav' | null }>({ isOpen: false, direction: null });
  const { showToast } = useToast();

  const handleModeSwitch = async (mode: 'webdav' | 'sqlite') => {
    if (mode === currentMode) return;

    const success = await setServerStorageMode(mode);
    if (!success) {
      showToast('切换模式失败，请重试', 'error');
      return;
    }

    await logoutServerSession();
    window.location.reload();
  };

  const loadSyncInfo = async () => {
    setSyncInfo(null);
    try {
      const [w, s] = await Promise.all([webdavAdapter.getPublicData(), sqliteAdapter.getPublicData()]);
      setSyncInfo({ webdav: w.updatedAt || 0, sqlite: s.updatedAt || 0 });
    } catch (e) {
      showToast('获取版本信息失败', 'error');
    }
  };

  useEffect(() => {
    loadSyncInfo();
  }, []);

  const executeSync = async (direction: 'to_sqlite' | 'to_webdav') => {
    setMigrating(true);
    try {
      const sourceAdapter = direction === 'to_sqlite' ? webdavAdapter : sqliteAdapter;
      const targetAdapter = direction === 'to_sqlite' ? sqliteAdapter : webdavAdapter;

      showToast('正在读取源数据...', 'info');
      const publicData = await sourceAdapter.getPublicData();
      const privateData = await sourceAdapter.getPrivateData();

      showToast('正在写入目标...', 'info');
      const pubRes = await targetAdapter.savePublicData(publicData);
      if (!pubRes.success) throw new Error(pubRes.error);

      const privRes = await targetAdapter.savePrivateData(privateData);
      if (!privRes.success) throw new Error(privRes.error);

      showToast('数据同步成功！', 'success');
      loadSyncInfo();
    } catch (e: any) {
      showToast(`同步失败: ${e.message}`, 'error');
    } finally {
      setMigrating(false);
      setSyncConfirm({ isOpen: false, direction: null });
    }
  };

  const formatDate = (ts?: number) => (ts && ts > 0 ? new Date(ts).toLocaleString() : '未知/无数据');

  return (
    <div className="flex flex-col gap-10 max-w-5xl mx-auto">
      <AdminCard title="存储设置">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleModeSwitch('webdav')}
              className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${currentMode === 'webdav' ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] hover:border-[color:var(--accent)]/50 text-[color:var(--text-secondary)]'}`}
            >
              <CloudUpload size={24} className={currentMode === 'webdav' ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'} />
              <span className="font-bold">WebDAV</span>
            </button>
            <button
              onClick={() => handleModeSwitch('sqlite')}
              className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${currentMode === 'sqlite' ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] hover:border-[color:var(--accent)]/50 text-[color:var(--text-secondary)]'}`}
            >
              <Database size={24} className={currentMode === 'sqlite' ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-secondary)]'} />
              <span className="font-bold">SQLite</span>
            </button>
          </div>

          <div className="pt-4 border-t border-[color:var(--line)] space-y-4">
            <h4 className="font-bold text-[color:var(--text-primary)]">数据状态</h4>

            {!syncInfo ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-[color:var(--text-primary)]" size={32} /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[color:var(--surface)]/70 rounded-xl border border-[color:var(--line)]">
                    <div className="font-bold text-[color:var(--text-secondary)] mb-2 flex items-center gap-2"><CloudUpload size={16} /> WebDAV</div>
                    <div className="text-sm font-mono text-[color:var(--text-primary)]">{formatDate(syncInfo.webdav)}</div>
                  </div>
                  <div className="p-4 bg-[color:var(--surface)]/70 rounded-xl border border-[color:var(--line)]">
                    <div className="font-bold text-[color:var(--text-secondary)] mb-2 flex items-center gap-2"><Database size={16} /> SQLite</div>
                    <div className="text-sm font-mono text-[color:var(--text-primary)]">{formatDate(syncInfo.sqlite)}</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Button onClick={() => setSyncConfirm({ isOpen: true, direction: 'to_sqlite' })} disabled={migrating} variant="secondary" className="w-full justify-between h-14 px-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)]/70">
                    <span className="flex items-center gap-2">
                      <CloudUpload size={18} />
                      <span>WebDAV 覆盖到 SQLite</span>
                    </span>
                    {migrating ? <Loader2 className="animate-spin" /> : <ChevronRight size={18} className="text-[color:var(--text-secondary)]" />}
                  </Button>
                  <Button onClick={() => setSyncConfirm({ isOpen: true, direction: 'to_webdav' })} disabled={migrating} variant="secondary" className="w-full justify-between h-14 px-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)]/70">
                    <span className="flex items-center gap-2">
                      <Database size={18} />
                      <span>SQLite 覆盖到 WebDAV</span>
                    </span>
                    {migrating ? <Loader2 className="animate-spin" /> : <ChevronRight size={18} className="text-[color:var(--text-secondary)]" />}
                  </Button>
                </div>
                <p className="text-xs text-[color:var(--text-secondary)] text-center">注意：同步操作将完全覆盖目标端的数据，不可恢复。</p>
              </>
            )}
          </div>
        </div>
      </AdminCard>

      <ConfirmModal
        isOpen={syncConfirm.isOpen}
        onClose={() => setSyncConfirm({ isOpen: false, direction: null })}
        onConfirm={() => syncConfirm.direction && executeSync(syncConfirm.direction)}
        title="数据覆盖确认"
        message={`确定要执行从 ${syncConfirm.direction === 'to_sqlite' ? 'WebDAV 到 SQLite' : 'SQLite 到 WebDAV'} 的覆盖同步吗？目标端现有数据将被永久覆盖且不可恢复。`}
        confirmText="确认覆盖"
        type="danger"
      />
    </div>
  );
};
