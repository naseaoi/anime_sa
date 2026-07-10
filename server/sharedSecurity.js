import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const PASSWORD_HASH_PREFIX = 'scrypt';

const scryptAsync = (password, salt, keylen, opts) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, opts, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });

export const timingSafeEqualText = (a, b) => {
  const aBuf = Buffer.from(String(a || ''), 'utf8');
  const bBuf = Buffer.from(String(b || ''), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

// scrypt 异步执行
export const hashPassword = async (password) => {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(String(password), salt, SCRYPT_KEYLEN, { N, r, p });
  return `${PASSWORD_HASH_PREFIX}$${N}$${r}$${p}$${salt}$${derived.toString('hex')}`;
};

export const verifyPasswordHash = async (password, encodedHash) => {
  try {
    const [prefix, nRaw, rRaw, pRaw, salt, expectedHex] = String(encodedHash || '').split('$');
    if (prefix !== PASSWORD_HASH_PREFIX || !salt || !expectedHex) return false;

    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const actual = await scryptAsync(String(password), salt, SCRYPT_KEYLEN, { N, r, p });
    return timingSafeEqualText(actual.toString('hex'), expectedHex);
  } catch {
    return false;
  }
};

export const normalizeMediaName = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return null;
  if (!/^[a-zA-Z0-9._-]{1,160}$/.test(raw)) return null;
  return raw;
};

const WEBDAV_ROOT_FILES = new Set(['public_data.json', 'private_data.json']);

export const normalizeWebDavFilename = (filename) => {
  const raw = String(filename || '').trim();
  if (!raw) return '';
  if (raw.includes('\\')) return null;

  const segments = raw.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;

  if (segments.length === 1) {
    if (segments[0] === 'covers' || WEBDAV_ROOT_FILES.has(segments[0])) return segments[0];
    return null;
  }

  if (segments.length !== 2 || segments[0] !== 'covers') return null;
  const mediaName = normalizeMediaName(segments[1]);
  if (!mediaName || mediaName === '.' || mediaName === '..') return null;
  return `covers/${mediaName}`;
};

export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;
export const PASSWORD_MIN_LEN = 6;
export const PASSWORD_MAX_LEN = 256;
const PASSWORD_HASH_MAX_LEN = 1024;

export const isValidUsername = (value) => USERNAME_PATTERN.test(String(value || ''));

export const normalizePrivateDataPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const username = String(payload.username || '').trim();
  if (!isValidUsername(username)) return null;

  const passwordHash = typeof payload.passwordHash === 'string' ? payload.passwordHash.trim() : '';
  if (!passwordHash) return null;
  if (passwordHash.length > PASSWORD_HASH_MAX_LEN) return null;

  if (payload.password !== undefined && payload.password !== null && payload.password !== '') {
    return null;
  }

  const passwordUpdatedAt = Number(payload.passwordUpdatedAt);
  return {
    username,
    passwordHash,
    passwordUpdatedAt: Number.isFinite(passwordUpdatedAt) ? passwordUpdatedAt : undefined
  };
};
