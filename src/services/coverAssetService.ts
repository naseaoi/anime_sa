import { CardData } from '../types';
import { StorageMode } from '../domain/storage';
import { getStorage } from './storageFactory';
import { normalizeCoverVariants } from '../utils/cardCover';

export interface CoverProcessFailure {
  id: string;
  title: string;
  reason: string;
}

const MEDIA_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

const imageDataUrlToBytes = (dataUrl: string) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return { mime, bytes };
};

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

const COVER_OUTPUTS: Array<{ key: 'thumb' | 'card'; maxWidth: number; quality: number }> = [
  { key: 'thumb', maxWidth: 640, quality: 0.72 },
  { key: 'card', maxWidth: 1280, quality: 0.80 }
];

const WEBP_MIME = 'image/webp';

const isCanvasSupported = () => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

const isTransformableMime = (mime: string) => {
  const lower = mime.toLowerCase();
  if (lower === 'image/gif' || lower === 'image/svg+xml') return false;
  return lower.startsWith('image/');
};

const buildAssetName = (cardId: string, mime: string, suffix = 'original') => {
  const ext = extensionByMime[mime] || 'bin';
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${cardId}-${Date.now()}-${suffix}-${randomPart}.${ext}`;
};

const ensureOk = async (res: Response) => {
  if (res.ok) return;
  const message = (await res.text().catch(() => '')).slice(0, 200);
  throw new Error(message || `上传失败（${res.status}）`);
};

const toCoverProcessFailure = (card: Pick<CardData, 'id' | 'title'>, error: unknown): CoverProcessFailure => {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  return {
    id: card.id,
    title: String(card.title || card.id || '未命名卡片'),
    reason: message || '未知错误'
  };
};

const uploadCoverBytes = async (
  cardId: string,
  mime: string,
  bytes: Uint8Array,
  suffix = 'original',
  _targetStorage?: StorageMode
) => {
  if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) {
    throw new Error('图片过大，请压缩后重试（最大 10MB）');
  }

  const assetName = buildAssetName(cardId, mime, suffix);

  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const body = new Blob([copied.buffer], { type: mime });

  const res = await fetch(`/api/storage/media?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': mime
    },
    body
  });
  await ensureOk(res);
  return `/api/storage/media?name=${encodeURIComponent(assetName)}`;
};

const loadImageBitmap = async (bytes: Uint8Array, mime: string): Promise<HTMLImageElement> => {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const blob = new Blob([copied.buffer], { type: mime });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('封面图片解码失败'));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const canvasToBytes = async (canvas: HTMLCanvasElement, mime: string, quality: number) => {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), mime, quality);
  });

  if (!blob) {
    throw new Error('封面缩略图导出失败');
  }

  const buffer = await blob.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    mime: String(blob.type || mime).toLowerCase()
  };
};

const buildCoverRenditions = async (mime: string, bytes: Uint8Array) => {
  const original = { mime, bytes };
  const renditions: Array<{ key: 'thumb' | 'card' | 'original'; mime: string; bytes: Uint8Array }> = [
    { key: 'original', mime, bytes: original.bytes }
  ];

  if (!isCanvasSupported() || !isTransformableMime(mime)) {
    return renditions;
  }

  const image = await loadImageBitmap(bytes, mime);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    return renditions;
  }

  for (const spec of COVER_OUTPUTS) {
    const targetWidth = Math.min(spec.maxWidth, sourceWidth);
    const targetHeight = Math.max(1, Math.round((sourceHeight * targetWidth) / sourceWidth));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      renditions.push({ key: spec.key, mime, bytes: original.bytes });
      continue;
    }

    drawWithHighQualityDownscale(ctx, image, sourceWidth, sourceHeight, targetWidth, targetHeight);

    try {
      let encoded = await canvasToBytes(canvas, WEBP_MIME, spec.quality);
      if (encoded.mime !== WEBP_MIME) {
        encoded = await canvasToBytes(canvas, mime, spec.quality);
      }
      renditions.push({ key: spec.key, mime: encoded.mime, bytes: encoded.bytes });
    } catch {
      renditions.push({ key: spec.key, mime, bytes: original.bytes });
    }
  }

  return renditions;
};

// 高质量下采样
const drawWithHighQualityDownscale = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) => {
  let currentSource: CanvasImageSource = image;
  let currentWidth = sourceWidth;
  let currentHeight = sourceHeight;

  while (currentWidth / targetWidth > 2) {
    const nextWidth = Math.max(targetWidth, Math.round(currentWidth / 2));
    const nextHeight = Math.max(targetHeight, Math.round(currentHeight / 2));
    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = nextWidth;
    stepCanvas.height = nextHeight;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentSource, 0, 0, nextWidth, nextHeight);
    currentSource = stepCanvas;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(currentSource, 0, 0, targetWidth, targetHeight);
};

const fetchImageBytesFromUrl = async (url: string) => {
  const parseResponse = async (response: Response) => {
    if (!response.ok) {
      throw new Error(`封面读取失败（${response.status}）`);
    }
    const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) {
      throw new Error('封面源不是图片资源');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { mime, bytes };
  };

  let parsed: URL | null = null;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {
    parsed = null;
  }

  const isCrossOrigin = !!parsed && parsed.origin !== window.location.origin;

  if (!isCrossOrigin) {
    try {
      const response = await fetch(url, { credentials: 'include' });
      return await parseResponse(response);
    } catch {
    }
  }

  const proxyUrl = `/api/storage/remote-image?url=${encodeURIComponent(parsed ? parsed.toString() : url)}`;
  const proxiedResponse = await fetch(proxyUrl, { credentials: 'include' });
  return parseResponse(proxiedResponse);
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

const hasDataUrlCover = (value?: string) => {
  return /^data:image\//i.test(String(value || ''));
};

const hasNetworkUrlCover = (value?: string) => {
  return /^(https?:)?\/\//i.test(String(value || '').trim());
};

const hasLocalMediaReference = (value?: string) => {
  return isLocalMediaUrl(value);
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

const isStorageMediaUrl = (value: string | undefined, _storage: StorageMode) => {
  const raw = String(value || '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw, 'http://localhost');
    return parsed.pathname === '/api/storage/media' || parsed.pathname === '/api/sqlite/media';
  } catch {
    return /^\/api\/(storage|sqlite)\/media(\?|$|\/)/i.test(raw);
  }
};

const isSqliteMediaUrl = (value?: string) => {
  return isStorageMediaUrl(value, 'sqlite');
};

const collectCardCoverValues = (card: Partial<CardData>) => {
  return [
    card.coverUrl,
    card.coverVariants?.thumb,
    card.coverVariants?.card,
    card.coverVariants?.original
  ];
};

const normalizeUrlBackedCoverForSync = <T extends Partial<CardData>>(card: T): T | null => {
  const coverUrl = getNetworkCoverUrl(card);
  if (!coverUrl) return null;

  const input = card.coverVariants || {};
  const nextVariants: CardData['coverVariants'] = {};

  for (const key of ['thumb', 'card', 'original'] as const) {
    const value = String(input[key] || '').trim();
    if (!value || isSqliteMediaUrl(value)) continue;
    nextVariants[key] = value;
  }

  if (!nextVariants.original) {
    nextVariants.original = coverUrl;
  }

  const hasVariants = Object.values(nextVariants).some((value) => !!value);
  return {
    ...card,
    coverUrl,
    coverLocalData: '',
    coverVariants: hasVariants ? nextVariants : undefined
  };
};

export const countSqliteMediaReferences = (cards: CardData[]) => {
  let total = 0;
  for (const card of cards) {
    for (const value of collectCardCoverValues(card)) {
      if (isSqliteMediaUrl(value)) total += 1;
    }
  }
  return total;
};

const shouldForceOptimizeUrlCover = (card: Partial<CardData>) => {
  const normalized = normalizeCoverVariants(card);
  if (!normalized && !card.coverUrl) return false;

  return [normalized?.original, normalized?.card, normalized?.thumb, card.coverUrl].some((value) => hasNetworkUrlCover(value));
};

const shouldMigrateCoverForStorage = (card: Partial<CardData>, source: StorageMode, target: StorageMode) => {
  if (source === target) return false;
  if (hasDataUrlCover(card.coverLocalData)) return true;
  const normalized = normalizeCoverVariants(card);
  if (!normalized) return false;

  return [normalized.original, normalized.card, normalized.thumb, card.coverUrl].some((value) => hasLocalMediaReference(value));
};

const collectCoverSourceCandidates = (card: Partial<CardData>) => {
  const normalized = normalizeCoverVariants(card);
  const seen = new Set<string>();
  const candidates = [normalized?.original, normalized?.card, normalized?.thumb, card.coverUrl];
  return candidates.filter((value): value is string => {
    const next = String(value || '').trim();
    if (!next || seen.has(next)) return false;
    seen.add(next);
    return true;
  });
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

const rebuildCardCoverForStorage = async <T extends Partial<CardData> & { id: string }>(
  card: T,
  target: StorageMode,
  options?: {
    sourceCandidates?: string[];
    includeEmbedded?: boolean;
  }
): Promise<T> => {
  const local = card.coverLocalData || '';
  const parsed = options?.includeEmbedded === false ? null : imageDataUrlToBytes(local);

  let source: { mime: string; bytes: Uint8Array } | null = parsed;
  let lastError: unknown = null;

  if (!source) {
    const candidates = options?.sourceCandidates || collectCoverSourceCandidates(card);
    for (const candidate of candidates) {
      try {
        source = await fetchImageBytesFromUrl(candidate);
        break;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (!source) {
    throw lastError instanceof Error ? lastError : new Error('未找到可迁移的封面源');
  }

  const renditions = await buildCoverRenditions(source.mime, source.bytes);
  const coverMap: Partial<Record<'thumb' | 'card' | 'original', string>> = {};

  for (const rendition of renditions) {
    if (coverMap[rendition.key]) continue;
    coverMap[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key, target);
  }

  const originalCoverUrl = coverMap.original || '';
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

const cacheUrlCoverVariantsForStorage = async <T extends Partial<CardData> & { id: string }>(
  card: T,
  target: StorageMode
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
    coverMap[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key, target);
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

export const migrateCardCoversToStorage = async (
  cards: CardData[],
  source: StorageMode,
  target: StorageMode
) => {
  let migrated = 0;
  let failed = 0;
  const nextCards: CardData[] = [];
  const failures: CoverProcessFailure[] = [];

  for (const card of cards) {
    const urlBackedCard = normalizeUrlBackedCoverForSync(card);
    if (urlBackedCard) {
      nextCards.push(urlBackedCard);
      continue;
    }

    if (!shouldMigrateCoverForStorage(card, source, target)) {
      nextCards.push(card);
      continue;
    }

    try {
      const nextCard = await rebuildCardCoverForStorage(card, target);
      nextCards.push(nextCard);
      migrated += 1;
    } catch (error) {
      nextCards.push(restoreNetworkCoverUrl(card) || card);
      failed += 1;
      failures.push(toCoverProcessFailure(card, error));
    }
  }

  return { cards: nextCards, migrated, failed, failures };
};

export const forceOptimizeUrlCardCovers = async (
  cards: CardData[],
  onProgress?: (progress: { total: number; done: number; optimized: number; failed: number }) => void
) => {
  const total = cards.length;
  let done = 0;
  let optimized = 0;
  let failed = 0;
  const nextCards: CardData[] = [];
  const targetStorage = getStorage().type;
  const failures: CoverProcessFailure[] = [];

  for (const card of cards) {
    if (!shouldForceOptimizeUrlCover(card)) {
      nextCards.push(card);
      done += 1;
      onProgress?.({ total, done, optimized, failed });
      continue;
    }

    try {
      const nextCard = await cacheUrlCoverVariantsForStorage(card, targetStorage);
      nextCards.push(nextCard);
      optimized += 1;
    } catch (error) {
      nextCards.push(restoreNetworkCoverUrl(card) || card);
      failed += 1;
      failures.push(toCoverProcessFailure(card, error));
    }

    done += 1;
    onProgress?.({ total, done, optimized, failed });
  }

  return { cards: nextCards, optimized, failed, total, failures };
};

export const optimizeCardCoverVariants = async (
  cards: CardData[],
  onProgress?: (progress: { total: number; done: number; optimized: number; failed: number }) => void
) => {
  const total = cards.length;
  let done = 0;
  let optimized = 0;
  let failed = 0;
  const nextCards: CardData[] = [];
  const failures: CoverProcessFailure[] = [];

  for (const card of cards) {
    const needsOptimize = needCoverVariantBackfill(card);
    if (!needsOptimize) {
      nextCards.push(card);
      done += 1;
      onProgress?.({ total, done, optimized, failed });
      continue;
    }

    try {
      const nextCard = await persistCardCover(card);
      nextCards.push(nextCard);
      optimized += 1;
    } catch (error) {
      nextCards.push(restoreNetworkCoverUrl(card) || card);
      failed += 1;
      failures.push(toCoverProcessFailure(card, error));
    }

    done += 1;
    onProgress?.({ total, done, optimized, failed });
  }

  return { cards: nextCards, optimized, failed, total, failures };
};
