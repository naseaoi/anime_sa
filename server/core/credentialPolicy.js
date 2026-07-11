import { hashPassword, isValidUsername, PASSWORD_MAX_LEN, PASSWORD_MIN_LEN } from '../sharedSecurity.js';

export const buildAdminCredentialsForSave = async (existing, payload) => {
  const username = String(payload?.username || '').trim();
  if (!isValidUsername(username)) return { error: '账号需由 3–64 位字母、数字、下划线或横线组成' };

  const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : '';
  const hasNewPassword = newPassword.length > 0;
  if (hasNewPassword && (newPassword.length < PASSWORD_MIN_LEN || newPassword.length > PASSWORD_MAX_LEN)) {
    return { error: `密码长度需在 ${PASSWORD_MIN_LEN}–${PASSWORD_MAX_LEN} 之间` };
  }

  const existingHash = typeof existing?.passwordHash === 'string' ? existing.passwordHash : '';
  const legacyPassword = typeof existing?.password === 'string' ? existing.password : '';
  let passwordHash = existingHash;
  const usernameChanged = username !== String(existing?.username || '');
  if (hasNewPassword) passwordHash = await hashPassword(newPassword);
  else if (!passwordHash && legacyPassword) passwordHash = await hashPassword(legacyPassword);
  if (!passwordHash) return { error: '请提供新密码' };

  return {
    data: {
      username,
      passwordHash,
      passwordUpdatedAt: hasNewPassword ? Date.now() : Number(existing?.passwordUpdatedAt || Date.now())
    },
    passwordChanged: hasNewPassword,
    changed: usernameChanged || hasNewPassword
  };
};
