import { dbGetJson, dbSetJson } from './kvStore.js';

export const appendAuditLog = (database, entry) => {
  const current = dbGetJson(database, 'audit_logs');
  const list = Array.isArray(current) ? current : [];
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    action: String(entry.action || 'unknown'),
    status: entry.status === 'failed' ? 'failed' : 'success',
    details: entry.details ? String(entry.details) : '',
    message: entry.message ? String(entry.message) : ''
  });
  dbSetJson(database, 'audit_logs', list.slice(0, 200));
};

export const cleanAuditText = (value, maxLength) => {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
};
