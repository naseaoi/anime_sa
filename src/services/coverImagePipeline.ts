export type CoverRendition = {
  key: 'thumb' | 'card' | 'original';
  mime: string;
  bytes: Uint8Array;
};

const COVER_OUTPUTS: Array<{ key: 'thumb' | 'card'; maxWidth: number; quality: number }> = [
  { key: 'thumb', maxWidth: 640, quality: 0.72 },
  { key: 'card', maxWidth: 1280, quality: 0.8 }
];

const WEBP_MIME = 'image/webp';

export const imageDataUrlToBytes = (dataUrl: string) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mime: match[1].toLowerCase(), bytes };
};

export const isCanvasSupported = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const isTransformableMime = (mime: string) => {
  const lower = mime.toLowerCase();
  return lower.startsWith('image/') && lower !== 'image/gif' && lower !== 'image/svg+xml';
};

const loadImage = async (bytes: Uint8Array, mime: string): Promise<HTMLImageElement> => {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const objectUrl = URL.createObjectURL(new Blob([copied.buffer], { type: mime }));
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('封面图片解码失败'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const canvasToBytes = async (canvas: HTMLCanvasElement, mime: string, quality: number) => {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw new Error('封面缩略图导出失败');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: String(blob.type || mime).toLowerCase() };
};

const drawDownscaled = (
  context: CanvasRenderingContext2D,
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
    const canvas = document.createElement('canvas');
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const stepContext = canvas.getContext('2d');
    if (!stepContext) break;
    stepContext.imageSmoothingEnabled = true;
    stepContext.imageSmoothingQuality = 'high';
    stepContext.drawImage(currentSource, 0, 0, nextWidth, nextHeight);
    currentSource = canvas;
    currentWidth = nextWidth;
    currentHeight = nextHeight;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(currentSource, 0, 0, targetWidth, targetHeight);
};

export const buildCoverRenditions = async (mime: string, bytes: Uint8Array): Promise<CoverRendition[]> => {
  const renditions: CoverRendition[] = [{ key: 'original', mime, bytes }];
  if (!isCanvasSupported() || !isTransformableMime(mime)) return renditions;

  const image = await loadImage(bytes, mime);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return renditions;

  for (const spec of COVER_OUTPUTS) {
    const targetWidth = Math.min(spec.maxWidth, sourceWidth);
    const targetHeight = Math.max(1, Math.round((sourceHeight * targetWidth) / sourceWidth));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      renditions.push({ key: spec.key, mime, bytes });
      continue;
    }
    drawDownscaled(context, image, sourceWidth, sourceHeight, targetWidth, targetHeight);
    try {
      let encoded = await canvasToBytes(canvas, WEBP_MIME, spec.quality);
      if (encoded.mime !== WEBP_MIME) encoded = await canvasToBytes(canvas, mime, spec.quality);
      renditions.push({ key: spec.key, mime: encoded.mime, bytes: encoded.bytes });
    } catch {
      renditions.push({ key: spec.key, mime, bytes });
    }
  }
  return renditions;
};
