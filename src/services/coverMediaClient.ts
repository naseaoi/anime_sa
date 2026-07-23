const MEDIA_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

const buildAssetName = (cardId: string, mime: string, suffix: string) => {
  const extension = extensionByMime[mime] || 'bin';
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${cardId}-${Date.now()}-${suffix}-${randomPart}.${extension}`;
};

const readImageResponse = async (response: Response) => {
  if (!response.ok) throw new Error(`封面读取失败（${response.status}）`);
  const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('image/')) throw new Error('封面源不是图片资源');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) throw new Error('图片过大，请压缩后重试（最大 10MB）');
  return { mime, bytes };
};

export const uploadCoverBytes = async (cardId: string, mime: string, bytes: Uint8Array, suffix = 'original') => {
  if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) throw new Error('图片过大，请压缩后重试（最大 10MB）');
  const assetName = buildAssetName(cardId, mime, suffix);
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const response = await fetch(`/api/storage/media?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': mime },
    body: new Blob([copied.buffer], { type: mime })
  });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(message || `上传失败（${response.status}）`);
  }
  return `/api/storage/media?name=${encodeURIComponent(assetName)}`;
};

export const fetchImageBytesFromUrl = async (url: string) => {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url, window.location.origin);
  } catch {}

  if (parsed && parsed.origin === window.location.origin) {
    try {
      return await readImageResponse(await fetch(url, { credentials: 'include' }));
    } catch {}
  }

  const target = parsed ? parsed.toString() : url;
  return readImageResponse(await fetch(`/api/storage/remote-image?url=${encodeURIComponent(target)}`, { credentials: 'include' }));
};
