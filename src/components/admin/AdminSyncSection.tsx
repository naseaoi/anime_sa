import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, CloudUpload, Database, Loader2, RefreshCw, WandSparkles } from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { getAuditLogs, getStorage, logoutServerSession, setServerStorageMode, sqliteAdapter, webdavAdapter } from '../../services/storageFactory';
import { Button, ConfirmModal, useToast } from '../Common';
import { AdminBadge, AdminPanel } from './ui';
import { SyncDirection, SyncOperations, StorageMode } from './hooks/useSyncOperations';

interface AdminSyncSectionProps {
  syncOps: SyncOperations;
  syncInfoToken: number;
}

export const AdminSyncSection: React.FC<AdminSyncSectionProps> = ({ syncOps, syncInfoToken }) => {
  const [currentMode] = useState<StorageMode>(getStorage().type);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [syncInfo, setSyncInfo] = useState<{ webdav?: number; sqlite?: number } | null>(null);
  const [syncConfirm, setSyncConfirm] = useState<{ isOpen: boolean; direction: SyncDirection | null }>({ isOpen: false, direction: null });
  const { showToast } = useToast();

  const {
    migrating,
    gcRunning,
    optimizingCovers,
    gcProgress,
    optimizeProgress,
    optimizeFailures,
    busy: actionDisabled,
    runSync,
    runGc,
    runOptimizeCovers,
    runForceUrlOptimize
  } = syncOps;

  const loadSyncInfo = useCallback(async () => {
    setSyncInfo(null);
    try {
      const [webdavData, sqliteData] = await Promise.all([webdavAdapter.getPublicData(), sqliteAdapter.getPublicData()]);
      setSyncInfo({ webdav: webdavData.updatedAt || 0, sqlite: sqliteData.updatedAt || 0 });
    } catch (e) {
      showToast('获取版本信息失败', 'error');
    }
  }, [showToast]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const result = await getAuditLogs(20);
    setAuditLoading(false);
    if (!result.success) {
      showToast(result.error || '读取日志失败', 'error');
      return;
    }
    setAuditLogs(result.items);
  }, [showToast]);

  useEffect(() => {
    loadSyncInfo();
    loadAudit();
  }, [loadAudit, loadSyncInfo, syncInfoToken]);

  const handleModeSwitch = async (mode: StorageMode) => {
    if (mode === currentMode) return;

    const success = await setServerStorageMode(mode);
    if (!success) {
      showToast('切换模式失败，请重试', 'error');
      return;
    }

    await logoutServerSession();
    window.location.reload();
  };


  const formatDate = (ts?: number) => (ts && ts > 0 ? new Date(ts).toLocaleString() : '未知/无数据');
  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      update_admin_credentials: '更新管理员凭据',
      sync_admin_credentials: '同步管理员凭据',
      sync_public_data: '同步公共数据',
      run_media_gc: '执行封面清理',
      write_public_data: '写入公共数据',
      write_storage_mode: '切换存储模式',
      write_private_data: '写入私有配置'
    };
    return map[action] || action;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <AdminPanel title="存储模式">
          <div className="grid gap-3 sm:grid-cols-2">
            <StorageModeButton
              active={currentMode === 'webdav'}
              icon={<CloudUpload size={18} />}
              title="WebDAV"
              subtitle="远程存储"
              onClick={() => handleModeSwitch('webdav')}
            />
            <StorageModeButton
              active={currentMode === 'sqlite'}
              icon={<Database size={18} />}
              title="SQLite"
              subtitle="本地数据库"
              onClick={() => handleModeSwitch('sqlite')}
            />
          </div>
        </AdminPanel>

        <AdminPanel title="数据版本">
          <div className="grid gap-3 sm:grid-cols-2">
            <VersionItem icon={<CloudUpload size={16} />} label="WebDAV" value={syncInfo ? formatDate(syncInfo.webdav) : null} />
            <VersionItem icon={<Database size={16} />} label="SQLite" value={syncInfo ? formatDate(syncInfo.sqlite) : null} />
          </div>
        </AdminPanel>

        <AdminPanel title="覆盖同步">
          <div className="space-y-3">
            <ActionButton
              icon={<CloudUpload size={17} />}
              title="WebDAV 覆盖到 SQLite"
              disabled={actionDisabled}
              loading={migrating}
              onClick={() => setSyncConfirm({ isOpen: true, direction: 'to_sqlite' })}
            />
            <ActionButton
              icon={<Database size={17} />}
              title="SQLite 覆盖到 WebDAV"
              disabled={actionDisabled}
              loading={migrating}
              onClick={() => setSyncConfirm({ isOpen: true, direction: 'to_webdav' })}
            />
            <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">
              同步会完全覆盖目标端数据，执行前确认方向。
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="封面维护">
          <div className="grid gap-3 lg:grid-cols-2">
            <ActionButton
              icon={<Database size={17} />}
              title="清理 SQLite 封面"
              disabled={actionDisabled}
              loading={gcRunning && gcProgress?.target === 'sqlite'}
              onClick={() => runGc('sqlite')}
            />
            <ActionButton
              icon={<CloudUpload size={17} />}
              title="清理 WebDAV 封面"
              disabled={actionDisabled}
              loading={gcRunning && gcProgress?.target === 'webdav'}
              onClick={() => runGc('webdav')}
            />
            <ActionButton
              icon={<WandSparkles size={17} />}
              title="优化已有封面"
              disabled={actionDisabled}
              loading={optimizingCovers}
              onClick={runOptimizeCovers}
            />
            <ActionButton
              icon={<RefreshCw size={17} />}
              title="优化 URL 封面"
              disabled={actionDisabled}
              loading={optimizingCovers}
              onClick={runForceUrlOptimize}
            />
          </div>

          {(gcProgress || optimizeProgress) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {gcProgress && (
                <ProgressBox
                  title={`${gcProgress.target.toUpperCase()} 清理`}
                  lines={[
                    `批次 ${gcProgress.rounds}`,
                    `已删 ${gcProgress.removed}`,
                    `候选 ${gcProgress.checked}`,
                    `剩余 ${gcProgress.pending}`
                  ]}
                />
              )}
              {optimizeProgress && (
                <ProgressBox
                  title="封面优化"
                  lines={[
                    `${optimizeProgress.done}/${optimizeProgress.total}`,
                    `已优化 ${optimizeProgress.optimized}`,
                    `失败 ${optimizeProgress.failed}`
                  ]}
                />
              )}
            </div>
          )}

          {optimizeFailures.length > 0 && (
            <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">
              <div className="mb-2 font-semibold">失败原因</div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {optimizeFailures.map((item) => (
                  <div key={`${item.id}-${item.reason}`} className="rounded-[6px] border border-red-200/70 bg-white/75 px-3 py-2 dark:border-red-900/50 dark:bg-black/10">
                    <div className="break-all font-medium">{item.title}</div>
                    <div className="break-all text-xs opacity-90">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AdminPanel>
      </div>

      <div className="relative min-h-0">
        <AdminPanel
          title="日志"
          action={
            <Button onClick={loadAudit} variant="ghost" size="sm" className="h-8 rounded-[6px] px-3" disabled={auditLoading}>
              {auditLoading ? <Loader2 className="animate-spin" size={14} /> : '刷新'}
            </Button>
          }
          className="flex flex-col xl:absolute xl:inset-0"
          bodyClassName="min-h-0 flex-1 overflow-y-auto p-0"
        >
          <div className="divide-y divide-[color:var(--line)]">
            {auditLogs.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[color:var(--text-secondary)]">暂无日志</div>
            ) : auditLogs.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{formatAction(item.action)}</div>
                    <div className="mt-1 break-words text-xs leading-relaxed text-[color:var(--text-secondary)]">{item.details || '-'} {item.message ? `· ${item.message}` : ''}</div>
                  </div>
                  <AdminBadge tone={item.status === 'success' ? 'success' : 'danger'}>{item.status === 'success' ? '成功' : '失败'}</AdminBadge>
                </div>
                <div className="mt-2 text-[11px] text-[color:var(--text-secondary)]">{new Date(item.ts).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </AdminPanel>
      </div>

      <ConfirmModal
        isOpen={syncConfirm.isOpen}
        onClose={() => setSyncConfirm({ isOpen: false, direction: null })}
        onConfirm={() => syncConfirm.direction && runSync(syncConfirm.direction)}
        title="数据覆盖确认"
        message={`确定要执行从 ${syncConfirm.direction === 'to_sqlite' ? 'WebDAV 到 SQLite' : 'SQLite 到 WebDAV'} 的覆盖同步吗？目标端现有数据将被永久覆盖且不可恢复。`}
        confirmText="确认覆盖"
        type="danger"
      />
    </div>
  );
};

const StorageModeButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}> = ({ active, icon, title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-3 rounded-[8px] border px-4 py-3 text-left transition-colors ${active ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--line)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-soft)] hover:text-[color:var(--text-primary)]'}`}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)]">{icon}</span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-[color:var(--text-secondary)]">{subtitle}</span>
    </span>
  </button>
);

const VersionItem: React.FC<{ icon: React.ReactNode; label: string; value: string | null }> = ({ icon, label, value }) => (
  <div className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-secondary)]">
      {icon}
      {label}
    </div>
    {value === null ? (
      <div className="h-5 w-3/4 animate-pulse rounded-[4px] bg-[color:var(--line)]" />
    ) : (
      <div className="break-all font-mono text-sm text-[color:var(--text-primary)]">{value}</div>
    )}
  </div>
);

const ActionButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}> = ({ icon, title, disabled, loading, onClick }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    variant="secondary"
    className="h-11 w-full justify-between rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3"
  >
    <span className="flex min-w-0 items-center gap-2">
      {icon}
      <span className="truncate">{title}</span>
    </span>
    {loading ? <Loader2 className="animate-spin" size={15} /> : <ChevronRight size={15} className="text-[color:var(--text-secondary)]" />}
  </Button>
);

const ProgressBox: React.FC<{ title: string; lines: string[] }> = ({ title, lines }) => (
  <div className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] p-3">
    <div className="mb-2 text-sm font-semibold text-[color:var(--text-primary)]">{title}</div>
    <div className="flex flex-wrap gap-2">
      {lines.map((line) => (
        <AdminBadge key={line}>{line}</AdminBadge>
      ))}
    </div>
  </div>
);
