import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const PASSWORD_HASH_PREFIX = 'scrypt';

export const timingSafeEqualText = (a, b) => {
  const aBuf = Buffer.from(String(a || ''), 'utf8');
  const bBuf = Buffer.from(String(b || ''), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const hashPassword = (password) => {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, { N, r, p }).toString('hex');
  return `${PASSWORD_HASH_PREFIX}$${N}$${r}$${p}$${salt}$${derived}`;
};

export const verifyPasswordHash = (password, encodedHash) => {
  try {
    const [prefix, nRaw, rRaw, pRaw, salt, expectedHex] = String(encodedHash || '').split('$');
    if (prefix !== PASSWORD_HASH_PREFIX || !salt || !expectedHex) return false;

    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const actualHex = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, { N, r, p }).toString('hex');
    return timingSafeEqualText(actualHex, expectedHex);
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

export const normalizePrivateDataPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const username = String(payload.username || '').trim();
  const passwordHash = typeof payload.passwordHash === 'string' ? payload.passwordHash.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const hasHash = passwordHash.length > 0;
  const hasPassword = password.length > 0;

  if (!username) return null;
  if (!hasHash && !hasPassword) return null;

  const passwordUpdatedAt = Number(payload.passwordUpdatedAt);
  return {
    username,
    passwordHash: hasHash ? passwordHash : null,
    password: hasPassword ? password : null,
    passwordUpdatedAt: Number.isFinite(passwordUpdatedAt) ? passwordUpdatedAt : undefined
  };
};
