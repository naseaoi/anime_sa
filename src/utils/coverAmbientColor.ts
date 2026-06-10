// 封面主色提取：缩采样 + 饱和度加权平均，按 cardId 缓存
const SAMPLE_SIZE = 16;
const MIN_LUMA = 56;
const MAX_LUMA = 150;

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const mix = (value: number, target: number, ratio: number) => value + (target - value) * ratio;

// 亮度压入 [MIN_LUMA, MAX_LUMA] 区间，输出适合做氛围光的色值
const normalizeLuma = (r: number, g: number, b: number): [number, number, number] => {
  const l = luma(r, g, b);
  if (l < MIN_LUMA && l > 0) {
    const ratio = (MIN_LUMA - l) / (255 - l);
    return [mix(r, 255, ratio), mix(g, 255, ratio), mix(b, 255, ratio)];
  }
  if (l > MAX_LUMA) {
    const ratio = (l - MAX_LUMA) / l;
    return [mix(r, 0, ratio), mix(g, 0, ratio), mix(b, 0, ratio)];
  }
  return [r, g, b];
};

const samplePixels = (img: HTMLImageElement): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let r = 0;
  let g = 0;
  let b = 0;
  let weightSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const saturation = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
    const weight = 1 + saturation / 48;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return null;

  const [nr, ng, nb] = normalizeLuma(r / weightSum, g / weightSum, b / weightSum);
  return `rgb(${clamp255(nr)}, ${clamp255(ng)}, ${clamp255(nb)})`;
};

const extract = (src: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // 跨域封面 taint canvas 时 getImageData 抛错，回退 null
      try {
        resolve(samplePixels(img));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

export const getCoverAmbientColor = (cardId: string, src: string): Promise<string | null> => {
  if (!src || typeof document === 'undefined') return Promise.resolve(null);

  const cached = cache.get(cardId);
  if (cached !== undefined) return Promise.resolve(cached);

  const inflight = pending.get(cardId);
  if (inflight) return inflight;

  const task = extract(src).then((color) => {
    cache.set(cardId, color);
    pending.delete(cardId);
    return color;
  });
  pending.set(cardId, task);
  return task;
};
