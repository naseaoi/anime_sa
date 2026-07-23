import { getPublicDataRevision, getPublicDataUpdatedAt, normalizePublicDataPayload } from '../publicDataValidation.js';

const PUBLIC_DATA_CONFLICT_ERROR = '数据已被其他会话更新，请刷新后重试';

const readHeader = (headers, name) => {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

export const preparePublicDataWrite = (payload, headers) => {
  const data = normalizePublicDataPayload(payload);
  if (!data) {
    return { ok: false, status: 400, error: 'Invalid public_data payload' };
  }

  const rawExpected = readHeader(headers, 'x-expected-revision');
  if (rawExpected === undefined || String(rawExpected).trim() === '') {
    return { ok: false, status: 400, error: 'Missing expected data revision' };
  }
  const expectedRevision = String(rawExpected).trim();
  if (expectedRevision.length > 128) {
    return { ok: false, status: 400, error: 'Invalid expected data revision' };
  }

  return { ok: true, data, expectedRevision };
};

export const buildPublicDataConflict = (currentRevision) => ({
  error: PUBLIC_DATA_CONFLICT_ERROR,
  currentRevision
});

export const buildPublicDataWriteSuccess = (data) => ({
  success: true,
  revision: getPublicDataRevision(data),
  updatedAt: getPublicDataUpdatedAt(data)
});
