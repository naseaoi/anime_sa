import { describe, expect, it } from 'vitest';
import { AUDIT_LIMITS, normalizeAuditEntry, normalizeAuditWritePayload } from './auditContract.js';

describe('audit contract', () => {
  it('normalizes internal audit entries consistently', () => {
    expect(normalizeAuditEntry({
      action: ' write_public_data ',
      status: 'unexpected',
      details: 'line  one\nline two'
    })).toEqual({
      action: 'write_public_data',
      status: 'success',
      details: 'line one line two',
      message: ''
    });
  });

  it('rejects invalid client audit payloads', () => {
    expect(normalizeAuditWritePayload({ action: '../bad', status: 'success' })).toEqual({ error: 'Invalid action' });
    expect(normalizeAuditWritePayload({ action: 'sync', status: 'other' })).toEqual({ error: 'Invalid audit status' });
  });

  it('applies shared text limits', () => {
    const result = normalizeAuditWritePayload({
      action: 'sync',
      status: 'failed',
      details: 'a'.repeat(AUDIT_LIMITS.details + 10),
      message: 'b'.repeat(AUDIT_LIMITS.message + 10)
    });

    expect(result.data.details).toHaveLength(AUDIT_LIMITS.details);
    expect(result.data.message).toHaveLength(AUDIT_LIMITS.message);
  });
});
