import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const PASSWORD_HASH_PREFIX = 'scrypt';
const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, saltHexLength: 32, digestHexLength: 128 });

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
    const parsed = parsePasswordHash(encodedHash);
    if (!parsed) return false;

    const actual = await scryptAsync(String(password), parsed.salt, SCRYPT_KEYLEN, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p
    });
    return timingSafeEqualText(actual.toString('hex'), parsed.expectedHex);
  } catch {
    return false;
  }
};

const parsePasswordHash = (encodedHash) => {
  const [prefix, nRaw, rRaw, pRaw, salt, expectedHex, extra] = String(encodedHash || '').split('$');
  if (extra !== undefined || prefix !== PASSWORD_HASH_PREFIX) return null;
  if (Number(nRaw) !== SCRYPT_PARAMS.N || Number(rRaw) !== SCRYPT_PARAMS.r || Number(pRaw) !== SCRYPT_PARAMS.p) return null;
  if (!new RegExp(`^[a-f0-9]{${SCRYPT_PARAMS.saltHexLength}}$`, 'i').test(salt || '')) return null;
  if (!new RegExp(`^[a-f0-9]{${SCRYPT_PARAMS.digestHexLength}}$`, 'i').test(expectedHex || '')) return null;
  return { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, salt, expectedHex };
};

export const isValidPasswordHash = (value) => parsePasswordHash(value) !== null;

export const normalizeMediaName = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return null;
  if (!/^[a-zA-Z0-9._-]{1,160}$/.test(raw)) return null;
  return raw;
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
  if (!passwordHash || passwordHash.length > PASSWORD_HASH_MAX_LEN || !isValidPasswordHash(passwordHash)) return null;

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
