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
  it('normalizes data and parses the expected revision', () => {
    const result = preparePublicDataWrite(createData(), { 'x-expected-revision': 'legacy:9' });

    expect(result.ok).toBe(true);
    expect(result.expectedRevision).toBe('legacy:9');
    expect(result.data.updatedAt).toBe(10);
  });

  it('accepts array-valued request headers', () => {
    const result = preparePublicDataWrite(createData(), { 'x-expected-revision': ['legacy:9', 'legacy:10'] });

    expect(result.ok).toBe(true);
    expect(result.expectedRevision).toBe('legacy:9');
  });

  it('rejects invalid payloads and expected versions consistently', () => {
    expect(preparePublicDataWrite({}, {}).error).toBe('Invalid public_data payload');
    expect(preparePublicDataWrite(createData(), {}).error).toBe('Missing expected data revision');
    expect(preparePublicDataWrite(createData(), { 'x-expected-revision': 'x'.repeat(129) }).error).toBe('Invalid expected data revision');
  });

  it('builds the same success and conflict payloads for every driver', () => {
    expect(buildPublicDataWriteSuccess(createData())).toEqual({ success: true, revision: 'legacy:10', updatedAt: 10 });
    expect(buildPublicDataConflict('legacy:9')).toEqual({
      error: '数据已被其他会话更新，请刷新后重试',
      currentRevision: 'legacy:9'
    });
  });
});
