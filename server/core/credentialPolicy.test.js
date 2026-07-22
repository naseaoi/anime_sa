import { describe, expect, it } from 'vitest';
import { buildAdminCredentialsResponse } from './credentialPolicy.js';

describe('admin credential contract', () => {
  it('requires a new login only when credentials changed', () => {
    expect(buildAdminCredentialsResponse({
      data: { username: 'admin' },
      passwordChanged: false,
      changed: false
    })).toEqual({
      success: true,
      username: 'admin',
      passwordChanged: false,
      requireRelogin: false
    });

    expect(buildAdminCredentialsResponse({
      data: { username: 'next-admin' },
      passwordChanged: true,
      changed: true
    }).requireRelogin).toBe(true);
  });
});
