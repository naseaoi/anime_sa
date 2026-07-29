import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Database, Loader2, RefreshCw, Server, WandSparkles } from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { StorageMode } from '../../domain/storage';
import { fetchStorageTransferInfo, getAuditLogs, getStorage, StorageTransferInfo } from '../../services/storageFactory';
import { Button, ConfirmModal, useToast } from '../Common';
import { AdminBadge, AdminPanel } from './ui';
import { SyncOperations } from './hooks/useSyncOperations';

interface AdminSyncSectionProps {
  syncOps: SyncOperations;
  syncInfoToken: number;
}

const storageModeLabel = (mode: StorageMode) => (mode === 'redis' ? 'Redis' : 'SQLite');

export const AdminSyncSection: React.FC<AdminSyncSectionProps> = ({ syncOps, syncInfoToken }) => {
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [transferInfo, setTransferInfo] = useState<StorageTransferInfo | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<{ source: StorageMode; target: StorageMode } | null>(null);
  const { showToast } = useToast();
  const storage = getStorage();
  const driverLabel = storageModeLabel(storage.type);

  const loadInfo = useCallback(async () => {
    try {
      const data = await storage.getPublicData();
      setUpdatedAt(Number(data.updatedAt || 0));
    } catch {
      showToast('获取存储信息失败', 'error');
    }
  }, [showToast, storage]);

  const loadTransferInfo = useCallback(async () => {
    setTransferInfo(await fetchStorageTransferInfo());
  }, []);

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
    loadInfo();
    loadTransferInfo();
    loadAudit();
  }, [loadAudit, loadInfo, loadTransferInfo, syncInfoToken]);

  const otherDrivers = (transferInfo?.available || []).filter((mode) => mode !== storage.type);

  const startTransfer = useCallback((source: StorageMode, target: StorageMode) => {
    void syncOps.runTransfer(source, target).then((ok) => {
      if (!ok || target !== storage.type) return;
      showToast('已恢复当前存储数据，即将刷新页面', 'info');
      window.setTimeout(() => window.location.reload(), 1500);
    });
  }, [showToast, storage.type, syncOps]);

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      update_admin_credentials: '更新管理员凭据',
      run_media_gc: '执行封面清理',
      write_public_data: '写入公共数据',
      write_private_data: '写入私有配置',
      transfer_storage: '存储数据传输',
      login: '管理员登录'
    };
    return map[action] || action;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <AdminPanel title="存储状态">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Database size={17} />当前驱动</div>
              <div className="mt-2 text-xl font-bold">{driverLabel}</div>
            </div>
            <div className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Server size={17} />数据版本</div>
              <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
                {updatedAt ? new Date(updatedAt).toLocaleString() : '暂无数据'}
              </div>
            </div>
          </div>
        </AdminPanel>

        {otherDrivers.length > 0 && (
          <AdminPanel title="数据传输">
            <p className="mb-3 text-xs text-[color:var(--text-secondary)]">
              在可用存储之间复制公共数据、管理员凭据与封面资源，目标中的同名数据会被覆盖。
            </p>
            <div className="space-y-3">
              {otherDrivers.map((other) => (
                <React.Fragment key={other}>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    disabled={syncOps.busy}
                    onClick={() => setConfirmTransfer({ source: storage.type, target: other })}
                  >
                    {syncOps.transferring ? <Loader2 size={17} className="animate-spin" /> : <ArrowLeftRight size={17} />}
                    备份到 {storageModeLabel(other)}
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    disabled={syncOps.busy}
                    onClick={() => setConfirmTransfer({ source: other, target: storage.type })}
                  >
                    {syncOps.transferring ? <Loader2 size={17} className="animate-spin" /> : <ArrowLeftRight size={17} />}
                    从 {storageModeLabel(other)} 恢复
                  </Button>
                </React.Fragment>
              ))}
            </div>
            {syncOps.transferProgress && syncOps.transferring && (
              <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
                {syncOps.transferProgress.stage === 'data'
                  ? '正在切换站点数据…'
                  : `正在传输封面：已复制 ${syncOps.transferProgress.copied} 个，待处理 ${syncOps.transferProgress.pending} 个`}
              </p>
            )}
          </AdminPanel>
        )}

        <AdminPanel title="存储维护">
          <div className="space-y-3">
            <Button variant="secondary" className="w-full justify-start" disabled={syncOps.busy} onClick={syncOps.runGc}>
              {syncOps.gcRunning ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
              清理未引用封面
            </Button>
            <Button variant="secondary" className="w-full justify-start" disabled={syncOps.busy} onClick={syncOps.runOptimizeCovers}>
              {syncOps.optimizingCovers ? <Loader2 size={17} className="animate-spin" /> : <WandSparkles size={17} />}
              补全封面缩略图
            </Button>
            <Button variant="secondary" className="w-full justify-start" disabled={syncOps.busy} onClick={syncOps.runForceUrlOptimize}>
              {syncOps.optimizingCovers ? <Loader2 size={17} className="animate-spin" /> : <WandSparkles size={17} />}
              缓存 URL 封面
            </Button>
          </div>
          {syncOps.gcProgress && (
            <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
              已检查 {syncOps.gcProgress.checked} 个资源，删除 {syncOps.gcProgress.removed} 个，宽限期内 {syncOps.gcProgress.deferred} 个，待处理 {syncOps.gcProgress.pending} 个
            </p>
          )}
          {syncOps.optimizeProgress && syncOps.optimizingCovers && (
            <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
              已处理 {syncOps.optimizeProgress.done}/{syncOps.optimizeProgress.total}，成功 {syncOps.optimizeProgress.optimized}，失败 {syncOps.optimizeProgress.failed}
            </p>
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        title="审计日志"
        action={(
          <Button variant="ghost" size="sm" onClick={loadAudit} disabled={auditLoading}>
            {auditLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            刷新
          </Button>
        )}
      >
        <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto scrollbar-thinest pr-1">
          {auditLogs.length === 0 && <p className="text-sm text-[color:var(--text-secondary)]">暂无日志</p>}
          {auditLogs.map((item) => (
            <div key={item.id} className="rounded-[8px] border border-[color:var(--line)] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{formatAction(item.action)}</span>
                <AdminBadge tone={item.status === 'failed' ? 'danger' : 'success'}>
                  {item.status === 'failed' ? '失败' : '成功'}
                </AdminBadge>
              </div>
              <p className="mt-1 text-[color:var(--text-secondary)]">{new Date(item.ts).toLocaleString()}</p>
              {item.message && <p className="mt-1 break-words">{item.message}</p>}
            </div>
          ))}
        </div>
      </AdminPanel>

      <ConfirmModal
        isOpen={!!confirmTransfer}
        onClose={() => setConfirmTransfer(null)}
        onConfirm={() => confirmTransfer && startTransfer(confirmTransfer.source, confirmTransfer.target)}
        title="确认数据传输"
        message={confirmTransfer
          ? `将把 ${storageModeLabel(confirmTransfer.source)} 中的公共数据、管理员凭据与封面资源复制到 ${storageModeLabel(confirmTransfer.target)}，并覆盖目标中的同名数据。是否继续？`
          : ''}
        confirmText="开始传输"
        type="danger"
      />
    </div>
  );
};
