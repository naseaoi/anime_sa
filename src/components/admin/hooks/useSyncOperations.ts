import { useCallback, useRef, useState } from 'react';
import { PublicData } from '../../../types';
import { StorageMode } from '../../../domain/storage';
import {
  runCoverGarbageCollectionBatch,
  runStorageDataTransfer,
  runStorageMediaTransferBatch
} from '../../../services/storageFactory';
import { CoverProcessFailure, forceOptimizeUrlCardCovers, optimizeCardCoverVariants } from '../../../services/coverAssetService';

export interface GcProgress {
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

export interface TransferProgress {
  stage: 'data' | 'media';
  copied: number;
  pending: number;
  total: number;
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
  gcRunning: boolean;
  optimizingCovers: boolean;
  transferring: boolean;
  gcProgress: GcProgress | null;
  optimizeProgress: OptimizeProgress | null;
  transferProgress: TransferProgress | null;
  optimizeFailures: CoverProcessFailure[];
  busy: boolean;
  runGc: () => Promise<void>;
  runOptimizeCovers: () => Promise<void>;
  runForceUrlOptimize: () => Promise<void>;
  runTransfer: (source: StorageMode, target: StorageMode) => Promise<boolean>;
}

export const useSyncOperations = ({ getData, onPersistData, showToast, reloadInfo }: SyncOperationsDeps): SyncOperations => {
  const [gcRunning, setGcRunning] = useState(false);
  const [optimizingCovers, setOptimizingCovers] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [gcProgress, setGcProgress] = useState<GcProgress | null>(null);
  const [optimizeProgress, setOptimizeProgress] = useState<OptimizeProgress | null>(null);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [optimizeFailures, setOptimizeFailures] = useState<CoverProcessFailure[]>([]);
  const depsRef = useRef({ getData, onPersistData, showToast, reloadInfo });
  depsRef.current = { getData, onPersistData, showToast, reloadInfo };

  const runGc = useCallback(async () => {
    const { showToast: notify, reloadInfo: refresh } = depsRef.current;
    setGcRunning(true);
    let totalRemoved = 0;
    let totalChecked = 0;
    let rounds = 0;
    let pending = 0;
    try {
      while (true) {
        const result = await runCoverGarbageCollectionBatch(80);
        if (!result.success) throw new Error(result.error);
        rounds += 1;
        totalRemoved += result.removed;
        totalChecked = Math.max(totalChecked, result.checked);
        pending = result.pending;
        setGcProgress({ rounds, removed: totalRemoved, checked: totalChecked, pending });
        if (!result.hasMore) break;
      }
      notify(`封面清理完成：删除 ${totalRemoved} 个未引用资源`, 'success');
      refresh();
    } catch (error: any) {
      notify(`封面清理失败: ${error.message}`, 'error');
    } finally {
      setGcRunning(false);
    }
  }, []);

  const runOptimize = useCallback(async (
    optimizer: typeof optimizeCardCoverVariants | typeof forceOptimizeUrlCardCovers,
    emptyMessage: string,
    buildSuccess: (optimized: number, failed: number) => string,
    errorLabel: string
  ) => {
    const { getData: readData, onPersistData: persist, showToast: notify, reloadInfo: refresh } = depsRef.current;
    const cards = readData().cards;
    setOptimizingCovers(true);
    setOptimizeProgress({ total: cards.length, done: 0, optimized: 0, failed: 0 });
    setOptimizeFailures([]);
    try {
      const result = await optimizer(cards, setOptimizeProgress);
      setOptimizeFailures(result.failures);
      if (result.optimized === 0 && result.failed === 0) {
        notify(emptyMessage, 'info');
        return;
      }
      await persist({ ...readData(), cards: result.cards }, buildSuccess(result.optimized, result.failed));
      refresh();
    } catch (error: any) {
      notify(`${errorLabel}: ${error?.message || '未知错误'}`, 'error');
    } finally {
      setOptimizingCovers(false);
    }
  }, []);

  const runOptimizeCovers = useCallback(
    () => runOptimize(
      optimizeCardCoverVariants,
      '当前封面已全部具备缩略图，无需优化',
      (optimized, failed) => `封面优化完成：新增 ${optimized} 张缩略图${failed > 0 ? `，失败 ${failed} 张` : ''}`,
      '封面优化失败'
    ),
    [runOptimize]
  );

  const runForceUrlOptimize = useCallback(
    () => runOptimize(
      forceOptimizeUrlCardCovers,
      '当前没有可强制优化的 URL 封面',
      (optimized, failed) => `URL 封面优化完成：生成缓存 ${optimized} 张${failed > 0 ? `，失败 ${failed} 张` : ''}`,
      'URL 封面优化失败'
    ),
    [runOptimize]
  );

  const runTransfer = useCallback(async (source: StorageMode, target: StorageMode) => {
    const { showToast: notify, reloadInfo: refresh } = depsRef.current;
    setTransferring(true);
    setTransferProgress({ stage: 'data', copied: 0, pending: 0, total: 0 });
    try {
      const dataResult = await runStorageDataTransfer(source, target);
      if (!dataResult.success) throw new Error(dataResult.error);

      let copiedTotal = 0;
      let skippedTotal = 0;
      while (true) {
        const result = await runStorageMediaTransferBatch(source, target, 50);
        if (!result.success) throw new Error(result.error);
        copiedTotal += result.copied;
        skippedTotal += result.skipped;
        setTransferProgress({ stage: 'media', copied: copiedTotal, pending: result.pending, total: result.total });
        if (!result.hasMore) break;
        if (result.copied === 0) throw new Error(`存在无法复制的封面资源（剩余 ${result.pending} 个）`);
      }

      notify(`数据传输完成：封面 ${copiedTotal} 个${skippedTotal > 0 ? `，跳过 ${skippedTotal} 个` : ''}`, 'success');
      refresh();
      return true;
    } catch (error: any) {
      notify(`数据传输失败: ${error?.message || '未知错误'}`, 'error');
      return false;
    } finally {
      setTransferring(false);
      setTransferProgress(null);
    }
  }, []);

  return {
    gcRunning,
    optimizingCovers,
    transferring,
    gcProgress,
    optimizeProgress,
    transferProgress,
    optimizeFailures,
    busy: gcRunning || optimizingCovers || transferring,
    runGc,
    runOptimizeCovers,
    runForceUrlOptimize,
    runTransfer
  };
};
