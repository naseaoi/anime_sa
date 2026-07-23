import { CardData } from '../types';
import { normalizeCoverVariants } from '../utils/cardCover';
import { buildCoverRenditions, imageDataUrlToBytes, isCanvasSupported } from './coverImagePipeline';
import { fetchImageBytesFromUrl, uploadCoverBytes } from './coverMediaClient';

export interface CoverProcessFailure {
  id: string;
  title: string;
  reason: string;
}

interface CoverProcessProgress {
  total: number;
  done: number;
  optimized: number;
  failed: number;
}

interface CoverBatchOptions {
  shouldProcess: (card: CardData) => boolean;
  process: (card: CardData) => Promise<CardData>;
  recover: (card: CardData) => CardData;
  onProgress?: (progress: CoverProcessProgress) => void;
}

const toCoverProcessFailure = (card: Pick<CardData, 'id' | 'title'>, error: unknown): CoverProcessFailure => {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  return {
    id: card.id,
    title: String(card.title || card.id || '未命名卡片'),
    reason: message || '未知错误'
  };
};

const backfillMissingCoverVariants = async (card: Partial<CardData> & { id: string }) => {
  const normalized = normalizeCoverVariants(card);
  if (!normalized || !normalized.original) return normalized;
  const canonicalCoverUrl = getNetworkCoverUrl(card) || normalized.original;
  const canonicalVariants = normalizeCoverVariants({
    ...card,
    coverUrl: canonicalCoverUrl,
    coverVariants: {
      ...normalized,
      original: canonicalCoverUrl
    }
  });
  if (!canonicalVariants) return normalized;
  if (!needVariantUpgradeToWebp(canonicalVariants)) return canonicalVariants;
  if (!isCanvasSupported()) return canonicalVariants;

  try {
    const source = await fetchImageBytesFromUrl(canonicalCoverUrl);
    const renditions = await buildCoverRenditions(source.mime, source.bytes);
    const uploaded: Partial<Record<'thumb' | 'card', string>> = {};

    for (const rendition of renditions) {
      if (rendition.key === 'original') continue;
      if (uploaded[rendition.key]) continue;
      uploaded[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key);
    }

    return normalizeCoverVariants({
      ...card,
      coverUrl: canonicalCoverUrl,
      coverVariants: {
        ...canonicalVariants,
        ...uploaded,
        original: canonicalCoverUrl
      }
    });
  } catch {
    return canonicalVariants;
  }
};

const processCoverBatch = async (cards: CardData[], options: CoverBatchOptions) => {
  const total = cards.length;
  let done = 0;
  let optimized = 0;
  let failed = 0;
  const nextCards: CardData[] = [];
  const failures: CoverProcessFailure[] = [];

  for (const card of cards) {
    if (!options.shouldProcess(card)) {
      nextCards.push(card);
    } else {
      try {
        nextCards.push(await options.process(card));
        optimized += 1;
      } catch (error) {
        nextCards.push(options.recover(card));
        failed += 1;
        failures.push(toCoverProcessFailure(card, error));
      }
    }

    done += 1;
    options.onProgress?.({ total, done, optimized, failed });
  }

  return { cards: nextCards, optimized, failed, total, failures };
};

const hasDataUrlCover = (value?: string) => {
  return /^data:image\//i.test(String(value || ''));
};

const hasNetworkUrlCover = (value?: string) => {
  return /^(https?:)?\/\//i.test(String(value || '').trim());
};

const getNetworkCoverUrl = (card: Partial<CardData>) => {
  const normalized = normalizeCoverVariants(card);
  const candidates = [card.coverUrl, normalized?.original, normalized?.card, normalized?.thumb];
  return candidates.map((value) => String(value || '').trim()).find((value) => hasNetworkUrlCover(value)) || '';
};

const restoreNetworkCoverUrl = <T extends Partial<CardData>>(card: T, options?: { clearLocalData?: boolean }): T | null => {
  const coverUrl = getNetworkCoverUrl(card);
  if (!coverUrl) return null;

  const normalized = normalizeCoverVariants(card);
  const coverVariants = normalizeCoverVariants({
    ...card,
    coverUrl,
    coverVariants: {
      ...(normalized || {}),
      original: coverUrl
    }
  });

  return {
    ...card,
    coverUrl,
    ...(options?.clearLocalData ? { coverLocalData: '' } : {}),
    coverVariants
  } as T;
};

const shouldForceOptimizeUrlCover = (card: Partial<CardData>) => {
  const normalized = normalizeCoverVariants(card);
  if (!normalized && !card.coverUrl) return false;

  return [normalized?.original, normalized?.card, normalized?.thumb, card.coverUrl].some((value) => hasNetworkUrlCover(value));
};

const collectNetworkCoverSourceCandidates = (card: Partial<CardData>) => {
  const normalized = normalizeCoverVariants(card);
  const seen = new Set<string>();
  const candidates = [card.coverUrl, normalized?.original, normalized?.card, normalized?.thumb];
  return candidates.filter((value): value is string => {
    const next = String(value || '').trim();
    if (!next || seen.has(next) || !hasNetworkUrlCover(next)) return false;
    seen.add(next);
    return true;
  });
};

const cacheUrlCoverVariantsForStorage = async <T extends Partial<CardData> & { id: string }>(
  card: T,
): Promise<T> => {
  const coverUrl = getNetworkCoverUrl(card);
  if (!coverUrl) throw new Error('未找到可优化的 URL 封面');

  let source: { mime: string; bytes: Uint8Array } | null = null;
  let lastError: unknown = null;
  const candidates = collectNetworkCoverSourceCandidates(card);

  for (const candidate of candidates) {
    try {
      source = await fetchImageBytesFromUrl(candidate);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!source) {
    throw lastError instanceof Error ? lastError : new Error('未找到可优化的 URL 封面');
  }

  const renditions = await buildCoverRenditions(source.mime, source.bytes);
  const coverMap: Partial<Record<'thumb' | 'card', string>> = {};

  for (const rendition of renditions) {
    if (rendition.key === 'original') continue;
    if (coverMap[rendition.key]) continue;
    coverMap[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key);
  }

  const normalizedCoverVariants = normalizeCoverVariants({
    ...card,
    coverUrl,
    coverVariants: {
      thumb: coverMap.thumb || coverUrl,
      card: coverMap.card || coverMap.thumb || coverUrl,
      original: coverUrl
    }
  });

  return { ...card, coverUrl, coverLocalData: '', coverVariants: normalizedCoverVariants };
};

const isWebpVariantUrl = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw, 'http://localhost');
    const filename = parsed.searchParams.get('name') || parsed.searchParams.get('filename') || parsed.pathname;
    return /\.webp($|[?#]|\/)/i.test(filename);
  } catch {
    return /\.webp($|[?#]|\/)/i.test(raw);
  }
};

// 本站媒体端点
const isLocalMediaUrl = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw, 'http://localhost');
    return /^\/api\/(storage|sqlite)\/media(\/|$)/i.test(parsed.pathname);
  } catch {
    return /^\/api\/(storage|sqlite)\/media(\/|$)/i.test(raw);
  }
};

// 已处理封面变体
const isProcessedVariantUrl = (value?: string) => {
  return isLocalMediaUrl(value) && isWebpVariantUrl(value);
};

const needVariantUpgradeToWebp = (normalized: { thumb?: string; card?: string; original?: string }) => {
  if (!normalized.thumb || !normalized.card || !normalized.original) return true;
  return !isProcessedVariantUrl(normalized.thumb) || !isProcessedVariantUrl(normalized.card);
};

const needNetworkCoverUrlRestore = (card: Partial<CardData>) => {
  const coverUrl = String(card.coverUrl || '').trim();
  const networkCoverUrl = getNetworkCoverUrl(card);
  return !!networkCoverUrl && coverUrl !== networkCoverUrl;
};

const needCoverVariantBackfill = (card: Partial<CardData>) => {
  if (hasDataUrlCover(card.coverLocalData)) return true;
  if (needNetworkCoverUrlRestore(card)) return true;
  const normalized = normalizeCoverVariants(card);
  if (!normalized) return false;
  return needVariantUpgradeToWebp(normalized);
};

export const persistCardCover = async <T extends Partial<CardData> & { id: string }>(card: T): Promise<T> => {
  const local = card.coverLocalData || '';
  const parsed = imageDataUrlToBytes(local);
  if (!parsed) {
    const mergedVariants = await backfillMissingCoverVariants(card);
    const restoredCard = restoreNetworkCoverUrl({ ...card, coverVariants: mergedVariants }, { clearLocalData: true });
    return restoredCard || { ...card, coverLocalData: '', coverVariants: mergedVariants };
  }

  const renditions = await buildCoverRenditions(parsed.mime, parsed.bytes);
  const coverMap: Partial<Record<'thumb' | 'card' | 'original', string>> = {};
  const networkCoverUrl = getNetworkCoverUrl(card);

  for (const rendition of renditions) {
    if (networkCoverUrl && rendition.key === 'original') continue;
    if (coverMap[rendition.key]) continue;
    coverMap[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key);
  }

  const originalCoverUrl = networkCoverUrl || coverMap.original || card.coverUrl || '';
  const normalizedCoverVariants = normalizeCoverVariants({
    ...card,
    coverUrl: originalCoverUrl,
    coverVariants: {
      thumb: coverMap.thumb,
      card: coverMap.card,
      original: coverMap.original || originalCoverUrl
    }
  });

  return { ...card, coverUrl: originalCoverUrl, coverLocalData: '', coverVariants: normalizedCoverVariants };
};

export const migrateEmbeddedCoverAssets = async (cards: CardData[]) => {
  let migrated = 0;
  const nextCards: CardData[] = [];

  for (const card of cards) {
    const parsed = imageDataUrlToBytes(card.coverLocalData || '');
    if (!parsed) {
      nextCards.push(card);
      continue;
    }

    try {
      const nextCard = await persistCardCover(card);
      nextCards.push(nextCard);
      migrated += 1;
    } catch {
      nextCards.push(card);
    }
  }

  return { cards: nextCards, migrated };
};

export const forceOptimizeUrlCardCovers = async (
  cards: CardData[],
  onProgress?: (progress: CoverProcessProgress) => void
) => processCoverBatch(cards, {
  shouldProcess: shouldForceOptimizeUrlCover,
  process: cacheUrlCoverVariantsForStorage,
  recover: (card) => restoreNetworkCoverUrl(card) || card,
  onProgress
});

export const optimizeCardCoverVariants = async (
  cards: CardData[],
  onProgress?: (progress: CoverProcessProgress) => void
) => processCoverBatch(cards, {
  shouldProcess: needCoverVariantBackfill,
  process: persistCardCover,
  recover: (card) => restoreNetworkCoverUrl(card) || card,
  onProgress
});
