import { describe, expect, it } from 'vitest';
import {
  buildPublicDataConflict,
  buildPublicDataWriteSuccess,
  preparePublicDataWrite
} from './publicDataWrite.js';

const createData = () => ({
  settings: { title: '收藏', iconUrl: '' },
  tags: [],
  cards: [],
  updatedAt: 10
});

describe('preparePublicDataWrite', () => {
  it('normalizes data and parses the expected version', () => {
    const result = preparePublicDataWrite(createData(), { 'x-expected-updated-at': '9' });

    expect(result.ok).toBe(true);
    expect(result.expectedUpdatedAt).toBe(9);
    expect(result.data.updatedAt).toBe(10);
  });

  it('accepts array-valued request headers', () => {
    const result = preparePublicDataWrite(createData(), { 'x-expected-updated-at': ['9', '10'] });

    expect(result.ok).toBe(true);
    expect(result.expectedUpdatedAt).toBe(9);
  });

  it('rejects invalid payloads and expected versions consistently', () => {
    expect(preparePublicDataWrite({}, {}).error).toBe('Invalid public_data payload');
    expect(preparePublicDataWrite(createData(), { 'x-expected-updated-at': '-1' }).error).toBe('Invalid expected data version');
    expect(preparePublicDataWrite(createData(), { 'x-expected-updated-at': 'not-a-number' }).status).toBe(400);
  });

  it('builds the same success and conflict payloads for every driver', () => {
    expect(buildPublicDataWriteSuccess(createData())).toEqual({ success: true, updatedAt: 10 });
    expect(buildPublicDataConflict(9)).toEqual({
      error: '数据已被其他会话更新，请刷新后重试',
      currentUpdatedAt: 9
    });
  });
});
