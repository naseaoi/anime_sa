import React, { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, RefreshCw, Server, WandSparkles } from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { getAuditLogs, getStorage } from '../../services/storageFactory';
import { Button, useToast } from '../Common';
import { AdminBadge, AdminPanel } from './ui';
import { SyncOperations } from './hooks/useSyncOperations';

interface AdminSyncSectionProps {
  syncOps: SyncOperations;
  syncInfoToken: number;
}

export const AdminSyncSection: React.FC<AdminSyncSectionProps> = ({ syncOps, syncInfoToken }) => {
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const { showToast } = useToast();
  const storage = getStorage();
  const driverLabel = storage.type === 'redis' ? 'Redis' : 'SQLite';

  const loadInfo = useCallback(async () => {
    try {
      const data = await storage.getPublicData();
      setUpdatedAt(Number(data.updatedAt || 0));
    } catch {
      showToast('获取存储信息失败', 'error');
    }
  }, [showToast, storage]);

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
    loadAudit();
  }, [loadAudit, loadInfo, syncInfoToken]);

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      update_admin_credentials: '更新管理员凭据',
      run_media_gc: '执行封面清理',
      write_public_data: '写入公共数据',
      write_private_data: '写入私有配置',
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
              已检查 {syncOps.gcProgress.checked} 个资源，删除 {syncOps.gcProgress.removed} 个，待处理 {syncOps.gcProgress.pending} 个
            </p>
          )}
          {syncOps.optimizeProgress && syncOps.optimizingCovers && (
            <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
              已处理 {syncOps.optimizeProgress.done}/{syncOps.optimizeProgress.total}，成功 {syncOps.optimizeProgress.optimized}，失败 {syncOps.optimizeProgress.failed}
            </p>
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="审计日志">
        <div className="mb-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={loadAudit} disabled={auditLoading}>
            {auditLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            刷新
          </Button>
        </div>
        <div className="space-y-2">
          {auditLogs.length === 0 && <p className="text-sm text-[color:var(--text-secondary)]">暂无日志</p>}
          {auditLogs.map((item) => (
            <div key={item.id} className="rounded-[8px] border border-[color:var(--line)] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{formatAction(item.action)}</span>
                <AdminBadge tone={item.status === 'failed' ? 'danger' : 'success'}>{item.status}</AdminBadge>
              </div>
              <p className="mt-1 text-[color:var(--text-secondary)]">{new Date(item.ts).toLocaleString()}</p>
              {item.message && <p className="mt-1 break-words">{item.message}</p>}
            </div>
          ))}
        </div>
      </AdminPanel>
    </div>
  );
};
