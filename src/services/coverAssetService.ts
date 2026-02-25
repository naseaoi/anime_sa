import { CardData } from '../types';
import { getStorage } from './storageFactory';
import { normalizeCoverVariants } from '../utils/cardCover';

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
  { key: 'thumb', maxWidth: 480, quality: 0.66 },
  { key: 'card', maxWidth: 960, quality: 0.76 }
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

const uploadCoverBytes = async (cardId: string, mime: string, bytes: Uint8Array, suffix = 'original') => {
  if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) {
    throw new Error('图片过大，请压缩后重试（最大 10MB）');
  }

  const adapter = getStorage();
  const assetName = buildAssetName(cardId, mime, suffix);

  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const body = new Blob([copied.buffer], { type: mime });

  if (adapter.type === 'webdav') {
    const filename = `covers/${assetName}`;
    const res = await fetch(`/api/webdav?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-dav-method': 'PUT',
        'Content-Type': mime
      },
      body
    });
    await ensureOk(res);
    return `/api/webdav?filename=${encodeURIComponent(filename)}`;
  }

  const res = await fetch(`/api/sqlite/media?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': mime
    },
    body
  });
  await ensureOk(res);
  return `/api/sqlite/media?name=${encodeURIComponent(assetName)}`;
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

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

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
      // fallback to server-side fetch below
    }
  }

  const proxyUrl = `/api/sqlite/remote-image?url=${encodeURIComponent(parsed ? parsed.toString() : url)}`;
  const proxiedResponse = await fetch(proxyUrl, { credentials: 'include' });
  return parseResponse(proxiedResponse);
};

const backfillMissingCoverVariants = async (card: Partial<CardData> & { id: string }) => {
  const normalized = normalizeCoverVariants(card);
  if (!normalized || !normalized.original) return normalized;
  if (!needVariantUpgradeToWebp(normalized)) return normalized;
  if (!isCanvasSupported()) return normalized;

  try {
    const source = await fetchImageBytesFromUrl(normalized.original);
    const renditions = await buildCoverRenditions(source.mime, source.bytes);
    const uploaded: Partial<Record<'thumb' | 'card', string>> = {};

    for (const rendition of renditions) {
      if (rendition.key === 'original') continue;
      if (uploaded[rendition.key]) continue;
      uploaded[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key);
    }

    return normalizeCoverVariants({
      ...card,
      coverUrl: normalized.original,
      coverVariants: {
        ...normalized,
        ...uploaded,
        original: normalized.original
      }
    });
  } catch {
    return normalized;
  }
};

const hasDataUrlCover = (value?: string) => {
  return /^data:image\//i.test(String(value || ''));
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

const needVariantUpgradeToWebp = (normalized: { thumb?: string; card?: string; original?: string }) => {
  if (!normalized.thumb || !normalized.card || !normalized.original) return true;
  return !isWebpVariantUrl(normalized.thumb) || !isWebpVariantUrl(normalized.card);
};

const needCoverVariantBackfill = (card: Partial<CardData>) => {
  if (hasDataUrlCover(card.coverLocalData)) return true;
  const normalized = normalizeCoverVariants(card);
  if (!normalized) return false;
  return needVariantUpgradeToWebp(normalized);
};

export const persistCardCover = async <T extends Partial<CardData> & { id: string }>(card: T): Promise<T> => {
  const local = card.coverLocalData || '';
  const parsed = imageDataUrlToBytes(local);
  if (!parsed) {
    const mergedVariants = await backfillMissingCoverVariants(card);
    return { ...card, coverLocalData: '', coverVariants: mergedVariants };
  }

  const renditions = await buildCoverRenditions(parsed.mime, parsed.bytes);
  const coverMap: Partial<Record<'thumb' | 'card' | 'original', string>> = {};

  for (const rendition of renditions) {
    if (coverMap[rendition.key]) continue;
    coverMap[rendition.key] = await uploadCoverBytes(card.id, rendition.mime, rendition.bytes, rendition.key);
  }

  const originalCoverUrl = coverMap.original || card.coverUrl || '';
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

export const optimizeCardCoverVariants = async (
  cards: CardData[],
  onProgress?: (progress: { total: number; done: number; optimized: number; failed: number }) => void
) => {
  const total = cards.length;
  let done = 0;
  let optimized = 0;
  let failed = 0;
  const nextCards: CardData[] = [];

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
    } catch {
      nextCards.push(card);
      failed += 1;
    }

    done += 1;
    onProgress?.({ total, done, optimized, failed });
  }

  return { cards: nextCards, optimized, failed, total };
};
