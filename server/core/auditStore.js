import { dbGetJson, dbSetJson } from './kvStore.js';
import { AUDIT_LIMITS, normalizeAuditEntry } from './auditContract.js';

export { cleanAuditText } from './auditContract.js';

export const appendAuditLog = (database, entry) => {
  const current = dbGetJson(database, 'audit_logs');
  const list = Array.isArray(current) ? current : [];
  const normalized = normalizeAuditEntry(entry);
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    ...normalized
  });
  dbSetJson(database, 'audit_logs', list.slice(0, AUDIT_LIMITS.entries));
};
