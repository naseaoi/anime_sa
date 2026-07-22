import { getPublicDataUpdatedAt, normalizePublicDataPayload } from '../publicDataValidation.js';

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

  const rawExpected = readHeader(headers, 'x-expected-updated-at');
  if (rawExpected === undefined) {
    return { ok: true, data, expectedUpdatedAt: undefined };
  }

  const expectedUpdatedAt = Number(rawExpected);
  if (!Number.isFinite(expectedUpdatedAt) || expectedUpdatedAt < 0) {
    return { ok: false, status: 400, error: 'Invalid expected data version' };
  }

  return { ok: true, data, expectedUpdatedAt };
};

export const buildPublicDataConflict = (currentUpdatedAt) => ({
  error: PUBLIC_DATA_CONFLICT_ERROR,
  currentUpdatedAt
});

export const buildPublicDataWriteSuccess = (data) => ({
  success: true,
  updatedAt: getPublicDataUpdatedAt(data)
});
