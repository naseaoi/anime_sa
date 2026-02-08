import { CardData } from '../types';
import { getStorage } from './storageFactory';

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

const buildAssetName = (cardId: string, mime: string) => {
  const ext = extensionByMime[mime] || 'bin';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${cardId}-${Date.now()}-${suffix}.${ext}`;
};

const ensureOk = async (res: Response) => {
  if (res.ok) return;
  const message = (await res.text().catch(() => '')).slice(0, 200);
  throw new Error(message || `上传失败（${res.status}）`);
};

const uploadCoverBytes = async (cardId: string, mime: string, bytes: Uint8Array) => {
  if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) {
    throw new Error('图片过大，请压缩后重试（最大 10MB）');
  }

  const adapter = getStorage();
  const assetName = buildAssetName(cardId, mime);

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

export const persistCardCover = async <T extends Partial<CardData> & { id: string }>(card: T): Promise<T> => {
  const local = card.coverLocalData || '';
  const parsed = imageDataUrlToBytes(local);
  if (!parsed) {
    return { ...card, coverLocalData: '' };
  }

  const uploadedCoverUrl = await uploadCoverBytes(card.id, parsed.mime, parsed.bytes);
  return { ...card, coverUrl: uploadedCoverUrl, coverLocalData: '' };
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
      const uploadedCoverUrl = await uploadCoverBytes(card.id, parsed.mime, parsed.bytes);
      nextCards.push({ ...card, coverUrl: uploadedCoverUrl, coverLocalData: '' });
      migrated += 1;
    } catch {
      nextCards.push(card);
    }
  }

  return { cards: nextCards, migrated };
};
