import { describe, expect, it } from 'vitest';
import type { CardData } from '../types';
import {
  clearCardDraft,
  clearCardDrafts,
  getCardDraftKey,
  loadCardDraft,
  saveCardDraft
} from './cardDraft';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const initialCard: Partial<CardData> = {
  id: 'card/1',
  title: '原始标题',
  coverUrl: '',
  description: '原始内容',
  startDate: '',
  endDate: '',
  rating: 3,
  tagIds: ['anime'],
  isRecommended: false,
  isWatching: false
};

describe('cardDraft', () => {
  it('按卡片保存并恢复已修改的表单内容', () => {
    const storage = new MemoryStorage();
    const changedCard = {
      ...initialCard,
      title: '修改后的标题',
      description: '未保存的内容',
      rating: 4.5,
      isRecommended: true
    };

    expect(saveCardDraft(storage, initialCard, changedCard, 1234)).toBe(true);
    expect(loadCardDraft(storage, initialCard)).toEqual({
      savedAt: 1234,
      card: {
        title: '修改后的标题',
        coverUrl: '',
        description: '未保存的内容',
        startDate: '',
        endDate: '',
        rating: 4.5,
        tagIds: ['anime'],
        isRecommended: true,
        isWatching: false
      }
    });
  });

  it('未修改内容时不保留草稿', () => {
    const storage = new MemoryStorage();

    expect(saveCardDraft(storage, initialCard, initialCard)).toBe(false);
    expect(loadCardDraft(storage, initialCard)).toBeNull();
  });

  it('不把本地封面数据写入草稿', () => {
    const storage = new MemoryStorage();
    const changedCard = {
      ...initialCard,
      description: '已修改',
      coverLocalData: 'data:image/png;base64,large-image-data'
    };

    saveCardDraft(storage, initialCard, changedCard, 1234);

    expect(storage.getItem(getCardDraftKey(initialCard))).not.toContain('large-image-data');
  });

  it('清除无效或被篡改的草稿', () => {
    const storage = new MemoryStorage();
    const storageKey = getCardDraftKey(initialCard);
    storage.setItem(storageKey, JSON.stringify({ version: 1, cardKey: storageKey, savedAt: 1234, card: { title: 42 } }));

    expect(loadCardDraft(storage, initialCard)).toBeNull();
    expect(storage.getItem(storageKey)).toBeNull();
  });

  it('保存成功后可清除草稿', () => {
    const storage = new MemoryStorage();
    saveCardDraft(storage, initialCard, { ...initialCard, title: '待保存' });

    clearCardDraft(storage, initialCard);

    expect(loadCardDraft(storage, initialCard)).toBeNull();
  });

  it('当前暂存数据等于草稿时隐藏提醒但保留恢复数据', () => {
    const storage = new MemoryStorage();
    const stagedCard = { ...initialCard, title: '页面内暂存' };
    saveCardDraft(storage, initialCard, stagedCard, 1234);

    expect(loadCardDraft(storage, stagedCard)).toBeNull();
    expect(storage.getItem(getCardDraftKey(initialCard))).not.toBeNull();
  });

  it('顶栏持久化后批量清除卡片与新建草稿', () => {
    const storage = new MemoryStorage();
    saveCardDraft(storage, initialCard, { ...initialCard, title: '编辑草稿' });
    saveCardDraft(storage, {}, { title: '新建草稿' });

    clearCardDrafts(storage, [initialCard], true);

    expect(storage.getItem(getCardDraftKey(initialCard))).toBeNull();
    expect(storage.getItem(getCardDraftKey({}))).toBeNull();
  });

  it('后台模式撤回到页面内基线时仍保留草稿', () => {
    const storage = new MemoryStorage();
    const stagedCard = { ...initialCard, title: '页面内暂存' };

    saveCardDraft(storage, stagedCard, stagedCard, 1234, true);

    expect(storage.getItem(getCardDraftKey(initialCard))).not.toBeNull();
  });

  it('后台顶栏保存不会清除前台新建草稿', () => {
    const storage = new MemoryStorage();
    saveCardDraft(storage, {}, { title: '前台草稿' });
    saveCardDraft(storage, {}, { title: '后台草稿' }, 1234, true, 'admin');

    clearCardDrafts(storage, [], true, 'admin');

    expect(storage.getItem(getCardDraftKey({}))).not.toBeNull();
    expect(storage.getItem(getCardDraftKey({}, 'admin'))).toBeNull();
  });
});
