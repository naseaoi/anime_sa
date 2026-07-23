const CONTENT_TYPE_ALIASES = Object.freeze({
  'image/jpg': 'image/jpeg'
});

export const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

export const normalizeImageContentType = (value) => {
  const raw = String(value || '').split(';')[0].trim().toLowerCase();
  const normalized = CONTENT_TYPE_ALIASES[raw] || raw;
  return ALLOWED_IMAGE_CONTENT_TYPES.has(normalized) ? normalized : null;
};

const startsWith = (bytes, signature) => signature.every((value, index) => bytes[index] === value);

export const detectImageContentType = (input) => {
  const bytes = Buffer.from(input || []);
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brands = bytes.subarray(8, Math.min(bytes.length, 40)).toString('ascii');
    if (brands.includes('avif') || brands.includes('avis')) return 'image/avif';
  }
  return null;
};

export const validateImageBytes = (declaredContentType, bytes) => {
  const contentType = normalizeImageContentType(declaredContentType);
  if (!contentType) return null;
  return detectImageContentType(bytes) === contentType ? { contentType, bytes: Buffer.from(bytes) } : null;
};
