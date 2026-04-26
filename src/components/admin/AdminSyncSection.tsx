import React, { useEffect, useState } from 'react';
import { ChevronRight, CloudUpload, Database, Loader2, WandSparkles } from 'lucide-react';
import { AuditLogEntry, PublicData } from '../../types';
import { getAuditLogs, getStorage, logoutServerSession, runCoverGarbageCollectionBatch, setServerStorageMode, sqliteAdapter, syncAdminCredentialsToTarget, webdavAdapter } from '../../services/storageFactory';
import { migrateCardCoversToStorage, optimizeCardCoverVariants } from '../../services/coverAssetService';
import { AdminCard, Button, ConfirmModal, useToast } from '../Common';

interface AdminSyncSectionProps {
  data: PublicData;
  onPersistData: (nextData: PublicData, successMessage: string) => Promise<boolean>;
}

export const AdminSyncSection: React.FC<AdminSyncSectionProps> = ({ data, onPersistData }) => {
  const [currentMode] = useState<'webdav' | 'sqlite'>(getStorage().type);
  const [migrating, setMigrating] = useState(false);
  const [gcRunning, setGcRunning] = useState(false);
  const [gcProgress, setGcProgress] = useState<{ target: 'sqlite' | 'webdav'; rounds: number; removed: number; checked: number; pending: number } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [optimizingCovers, setOptimizingCovers] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState<{ total: number; done: number; optimized: number; failed: number } | null>(null);
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

  const executeCoverOptimize = async () => {
    setOptimizingCovers(true);
    setOptimizeProgress({ total: data.cards.length, done: 0, optimized: 0, failed: 0 });

    try {
      const result = await optimizeCardCoverVariants(data.cards, setOptimizeProgress);
      if (result.optimized === 0 && result.failed === 0) {
        showToast('当前封面已全部具备缩略图，无需优化', 'info');
        return;
      }

      const success = await onPersistData(
        { ...data, cards: result.cards },
        `封面优化完成：新增 ${result.optimized} 张缩略图${result.failed > 0 ? `，失败 ${result.failed} 张` : ''}`
      );

      if (!success && result.failed > 0) {
        showToast(`封面优化未完整保存，失败 ${result.failed} 张`, 'error');
      }
      loadAudit();
    } catch (e: any) {
      showToast(`封面优化失败: ${e?.message || '未知错误'}`, 'error');
    } finally {
      setOptimizingCovers(false);
    }
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

  const loadAudit = async () => {
    setAuditLoading(true);
    const result = await getAuditLogs(20);
    setAuditLoading(false);
    if (!result.success) {
      showToast(result.error || '读取日志失败', 'error');
      return;
    }
    setAuditLogs(result.items);
  };

  useEffect(() => {
    loadSyncInfo();
    loadAudit();
  }, []);

  const executeGc = async (target: 'sqlite' | 'webdav') => {
    setGcRunning(true);
    let totalRemoved = 0;
    let totalChecked = 0;
    let rounds = 0;
    let pending = 0;

    try {
      while (true) {
        const result = await runCoverGarbageCollectionBatch(target, 80);
        if (!result.success) throw new Error(result.error);

        rounds += 1;
        totalRemoved += result.removed;
        totalChecked = Math.max(totalChecked, result.checked);
        pending = result.pending;
        setGcProgress({ target, rounds, removed: totalRemoved, checked: totalChecked, pending });

        if (!result.hasMore) break;
      }

      showToast(`封面清理完成：删除 ${totalRemoved} 个未引用资源`, 'success');
      loadAudit();
    } catch (e: any) {
      showToast(`封面清理失败: ${e.message}`, 'error');
    } finally {
      setGcRunning(false);
    }
  };

  const executeSync = async (direction: 'to_sqlite' | 'to_webdav') => {
    setMigrating(true);
    try {
      const sourceAdapter = direction === 'to_sqlite' ? webdavAdapter : sqliteAdapter;
      const targetAdapter = direction === 'to_sqlite' ? sqliteAdapter : webdavAdapter;
      const targetMode = direction === 'to_sqlite' ? 'sqlite' : 'webdav';

      showToast('正在读取源数据...', 'info');
      const publicData = await sourceAdapter.getPublicData();
      const privateData = await sourceAdapter.getPrivateData();

      showToast('正在迁移封面资源...', 'info');
      const migratedCovers = await migrateCardCoversToStorage(publicData.cards, sourceAdapter.type, targetMode);
      const nextPublicData = { ...publicData, cards: migratedCovers.cards };

      showToast('正在写入目标...', 'info');
      const pubRes = await targetAdapter.savePublicData(nextPublicData);
      if (!pubRes.success) throw new Error(pubRes.error);

      if (privateData?.username) {
        const privRes = await syncAdminCredentialsToTarget(targetMode, privateData);
        if (!privRes.success) throw new Error(privRes.error);
      }

      const coverSummary = migratedCovers.migrated > 0 || migratedCovers.failed > 0
        ? ` 封面迁移 ${migratedCovers.migrated} 张${migratedCovers.failed > 0 ? `，失败 ${migratedCovers.failed} 张` : ''}。`
        : ' ';
      showToast(`数据同步成功！${coverSummary}可按需执行封面清理。`, migratedCovers.failed > 0 ? 'info' : 'success');
      loadSyncInfo();
      loadAudit();
    } catch (e: any) {
      showToast(`同步失败: ${e.message}`, 'error');
    } finally {
      setMigrating(false);
      setSyncConfirm({ isOpen: false, direction: null });
    }
  };

  const formatDate = (ts?: number) => (ts && ts > 0 ? new Date(ts).toLocaleString() : '未知/无数据');
  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      update_admin_credentials: '更新管理员凭据',
      sync_admin_credentials: '同步管理员凭据',
      run_media_gc: '执行封面清理',
      write_public_data: '写入公共数据',
      write_storage_mode: '切换存储模式',
      write_private_data: '写入私有配置'
    };
    return map[action] || action;
  };

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

      <AdminCard title="封面资源清理">
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--text-secondary)]">按批次清理未被卡片引用的封面资源，避免存储体积长期膨胀。</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={() => executeGc('sqlite')} disabled={gcRunning || migrating} variant="secondary" className="h-12 rounded-xl justify-between border border-[color:var(--line)] bg-[color:var(--surface)]/70">
              <span className="flex items-center gap-2"><Database size={16} /> 清理 SQLite 封面</span>
              {gcRunning && gcProgress?.target === 'sqlite' ? <Loader2 className="animate-spin" size={16} /> : <ChevronRight size={16} className="text-[color:var(--text-secondary)]" />}
            </Button>
            <Button onClick={() => executeGc('webdav')} disabled={gcRunning || migrating} variant="secondary" className="h-12 rounded-xl justify-between border border-[color:var(--line)] bg-[color:var(--surface)]/70">
              <span className="flex items-center gap-2"><CloudUpload size={16} /> 清理 WebDAV 封面</span>
              {gcRunning && gcProgress?.target === 'webdav' ? <Loader2 className="animate-spin" size={16} /> : <ChevronRight size={16} className="text-[color:var(--text-secondary)]" />}
            </Button>
          </div>
          {gcProgress && (
            <div className="p-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]/60 text-sm text-[color:var(--text-secondary)]">
              目标：{gcProgress.target.toUpperCase()}，批次：{gcProgress.rounds}，已删：{gcProgress.removed}，候选总数：{gcProgress.checked}，剩余：{gcProgress.pending}
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard title="封面缩略图优化">
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--text-secondary)]">批量为历史卡片补齐封面缩略图（thumb/card/original），无需逐条打开编辑保存。</p>
          <Button
            onClick={executeCoverOptimize}
            disabled={optimizingCovers || gcRunning || migrating}
            variant="secondary"
            className="w-full h-12 rounded-xl justify-between border border-[color:var(--line)] bg-[color:var(--surface)]/70"
          >
            <span className="flex items-center gap-2"><WandSparkles size={16} /> 一键优化已有封面</span>
            {optimizingCovers ? <Loader2 className="animate-spin" size={16} /> : <ChevronRight size={16} className="text-[color:var(--text-secondary)]" />}
          </Button>
          {optimizeProgress && (
            <div className="p-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]/60 text-sm text-[color:var(--text-secondary)]">
              进度：{optimizeProgress.done}/{optimizeProgress.total}，已优化：{optimizeProgress.optimized}，失败：{optimizeProgress.failed}
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard
        title="操作日志"
        action={<Button onClick={loadAudit} variant="ghost" size="sm" className="h-8 px-3" disabled={auditLoading}>{auditLoading ? <Loader2 className="animate-spin" size={14} /> : '刷新'}</Button>}
      >
        <div className="space-y-2">
          {auditLogs.length === 0 ? (
            <div className="text-sm text-[color:var(--text-secondary)]">暂无日志</div>
          ) : auditLogs.map((item) => (
            <div key={item.id} className="p-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">{formatAction(item.action)}</div>
                <div className="text-xs text-[color:var(--text-secondary)] truncate">{item.details || '-'} {item.message ? `· ${item.message}` : ''}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xs font-bold ${item.status === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>{item.status === 'success' ? '成功' : '失败'}</div>
                <div className="text-[11px] text-[color:var(--text-secondary)]">{new Date(item.ts).toLocaleString()}</div>
              </div>
            </div>
          ))}
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
