import { useCallback, useRef, useState } from 'react';
import { PublicData } from '../../../types';
import {
  runCoverGarbageCollectionBatch,
  sqliteAdapter,
  syncAdminCredentialsToTarget,
  webdavAdapter
} from '../../../services/storageFactory';
import {
  CoverProcessFailure,
  forceOptimizeUrlCardCovers,
  migrateCardCoversToStorage,
  optimizeCardCoverVariants
} from '../../../services/coverAssetService';

export type SyncDirection = 'to_sqlite' | 'to_webdav';
export type StorageMode = 'webdav' | 'sqlite';

export interface GcProgress {
  target: StorageMode;
  rounds: number;
  removed: number;
  checked: number;
  pending: number;
}

export interface OptimizeProgress {
  total: number;
  done: number;
  optimized: number;
  failed: number;
}

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;
type PersistFn = (nextData: PublicData, successMessage: string) => Promise<boolean>;

interface SyncOperationsDeps {
  getData: () => PublicData;
  onPersistData: PersistFn;
  showToast: ToastFn;
  reloadInfo: () => void;
}

export interface SyncOperations {
  migrating: boolean;
  gcRunning: boolean;
  optimizingCovers: boolean;
  gcProgress: GcProgress | null;
  optimizeProgress: OptimizeProgress | null;
  optimizeFailures: CoverProcessFailure[];
  busy: boolean;
  runSync: (direction: SyncDirection) => Promise<void>;
  runGc: (target: StorageMode) => Promise<void>;
  runOptimizeCovers: () => Promise<void>;
  runForceUrlOptimize: () => Promise<void>;
}

export const useSyncOperations = ({ getData, onPersistData, showToast, reloadInfo }: SyncOperationsDeps): SyncOperations => {
  const [migrating, setMigrating] = useState(false);
  const [gcRunning, setGcRunning] = useState(false);
  const [optimizingCovers, setOptimizingCovers] = useState(false);
  const [gcProgress, setGcProgress] = useState<GcProgress | null>(null);
  const [optimizeProgress, setOptimizeProgress] = useState<OptimizeProgress | null>(null);
  const [optimizeFailures, setOptimizeFailures] = useState<CoverProcessFailure[]>([]);

  const depsRef = useRef({ getData, onPersistData, showToast, reloadInfo });
  depsRef.current = { getData, onPersistData, showToast, reloadInfo };

  const busy = migrating || gcRunning || optimizingCovers;

  const runSync = useCallback(async (direction: SyncDirection) => {
    const { showToast, reloadInfo } = depsRef.current;
    setMigrating(true);
    try {
      const sourceAdapter = direction === 'to_sqlite' ? webdavAdapter : sqliteAdapter;
      const targetAdapter = direction === 'to_sqlite' ? sqliteAdapter : webdavAdapter;
      const targetMode: StorageMode = direction === 'to_sqlite' ? 'sqlite' : 'webdav';

      showToast('正在读取源数据...', 'info');
      const publicData = await sourceAdapter.getPublicData();
      const privateData = await sourceAdapter.getPrivateData();

      showToast('正在迁移封面资源...', 'info');
      const migratedCovers = await migrateCardCoversToStorage(publicData.cards, sourceAdapter.type, targetMode);
      const nextPublicData = { ...publicData, cards: migratedCovers.cards };

      showToast('正在写入目标...', 'info');
      const publicResult = await targetAdapter.savePublicData(nextPublicData);
      if (!publicResult.success) throw new Error(publicResult.error);

      if (privateData?.username) {
        const privateResult = await syncAdminCredentialsToTarget(targetMode, privateData);
        if (!privateResult.success) throw new Error(privateResult.error);
      }

      const coverSummary = migratedCovers.migrated > 0 || migratedCovers.failed > 0
        ? ` 封面迁移 ${migratedCovers.migrated} 张${migratedCovers.failed > 0 ? `，失败 ${migratedCovers.failed} 张` : ''}。`
        : ' ';
      showToast(`数据同步成功！${coverSummary}可按需执行封面清理。`, migratedCovers.failed > 0 ? 'info' : 'success');
      reloadInfo();
    } catch (e: any) {
      showToast(`同步失败: ${e.message}`, 'error');
    } finally {
      setMigrating(false);
    }
  }, []);

  const runGc = useCallback(async (target: StorageMode) => {
    const { showToast, reloadInfo } = depsRef.current;
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
      reloadInfo();
    } catch (e: any) {
      showToast(`封面清理失败: ${e.message}`, 'error');
    } finally {
      setGcRunning(false);
    }
  }, []);

  const runOptimize = useCallback(async (
    optimizer: typeof optimizeCardCoverVariants | typeof forceOptimizeUrlCardCovers,
    emptyMessage: string,
    buildSuccess: (optimized: number, failed: number) => string,
    failLabel: string,
    errorLabel: string
  ) => {
    const { getData, onPersistData, showToast, reloadInfo } = depsRef.current;
    const cards = getData().cards;
    setOptimizingCovers(true);
    setOptimizeProgress({ total: cards.length, done: 0, optimized: 0, failed: 0 });
    setOptimizeFailures([]);

    try {
      const result = await optimizer(cards, setOptimizeProgress);
      setOptimizeFailures(result.failures);
      if (result.optimized === 0 && result.failed === 0) {
        showToast(emptyMessage, 'info');
        return;
      }

      const success = await onPersistData(
        { ...getData(), cards: result.cards },
        buildSuccess(result.optimized, result.failed)
      );

      if (!success && result.failed > 0) {
        showToast(`${failLabel}，失败 ${result.failed} 张`, 'error');
      }
      reloadInfo();
    } catch (e: any) {
      showToast(`${errorLabel}: ${e?.message || '未知错误'}`, 'error');
    } finally {
      setOptimizingCovers(false);
    }
  }, []);

  const runOptimizeCovers = useCallback(
    () => runOptimize(
      optimizeCardCoverVariants,
      '当前封面已全部具备缩略图，无需优化',
      (optimized, failed) => `封面优化完成：新增 ${optimized} 张缩略图${failed > 0 ? `，失败 ${failed} 张` : ''}`,
      '封面优化未完整保存',
      '封面优化失败'
    ),
    [runOptimize]
  );

  const runForceUrlOptimize = useCallback(
    () => runOptimize(
      forceOptimizeUrlCardCovers,
      '当前没有可强制优化的 URL 封面',
      (optimized, failed) => `URL 封面优化完成：转存 ${optimized} 张${failed > 0 ? `，失败 ${failed} 张` : ''}`,
      'URL 封面优化未完整保存',
      'URL 封面优化失败'
    ),
    [runOptimize]
  );

  return {
    migrating,
    gcRunning,
    optimizingCovers,
    gcProgress,
    optimizeProgress,
    optimizeFailures,
    busy,
    runSync,
    runGc,
    runOptimizeCovers,
    runForceUrlOptimize
  };
};

