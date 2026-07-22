export const AUDIT_LIMITS = Object.freeze({
  action: 64,
  details: 300,
  message: 800,
  entries: 200
});

export const cleanAuditText = (value, maxLength) => (
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
);

const normalizeAction = (value, fallback = '') => {
  const action = cleanAuditText(value, AUDIT_LIMITS.action);
  if (!action) return fallback;
  return /^[a-z0-9_:-]+$/i.test(action) ? action : '';
};

export const normalizeAuditEntry = (entry) => ({
  action: normalizeAction(entry?.action, 'unknown') || 'unknown',
  status: entry?.status === 'failed' ? 'failed' : 'success',
  details: cleanAuditText(entry?.details, AUDIT_LIMITS.details),
  message: cleanAuditText(entry?.message, AUDIT_LIMITS.message)
});

export const normalizeAuditWritePayload = (payload) => {
  const action = normalizeAction(payload?.action);
  if (!action) return { error: 'Invalid action' };
  if (!['success', 'failed'].includes(payload?.status)) return { error: 'Invalid audit status' };

  return {
    data: {
      action,
      status: payload.status,
      details: cleanAuditText(payload?.details, AUDIT_LIMITS.details),
      message: cleanAuditText(payload?.message, AUDIT_LIMITS.message)
    }
  };
};
