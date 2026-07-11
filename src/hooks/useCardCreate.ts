import { useState } from 'react';
import { CardData, PublicData } from '../types';
import { getStorage } from '../services/storageFactory';
import { persistCardCover } from '../services/coverAssetService';
import { useToast } from '../components/Common';

export const QUICK_CREATE_INITIAL_CARD: Partial<CardData> = {
  tagIds: [],
  rating: 0,
  description: '',
  startDate: '',
  endDate: '',
  isRecommended: false,
  isWatching: false
};

// 快速创建卡片：弹窗开关 + 保存流程
export const useCardCreate = (data: PublicData, refreshData?: () => Promise<void>) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { showToast } = useToast();

  const handleCreateSave = async (cardData: Partial<CardData>) => {
    try {
      const now = Date.now();
      const draftCard: CardData = {
        id: now.toString(),
        title: cardData.title || 'Untitled',
        coverUrl: cardData.coverUrl || '',
        coverLocalData: cardData.coverLocalData || '',
        description: cardData.description || '',
        startDate: cardData.startDate || '',
        endDate: cardData.endDate || '',
        rating: cardData.rating || 0,
        tagIds: cardData.tagIds || [],
        isRecommended: !!cardData.isRecommended,
        isWatching: !!cardData.isWatching,
        createdAt: now,
        updatedAt: now
      };

      const newCard = await persistCardCover(draftCard);
      const result = await getStorage().savePublicData(
        { ...data, cards: [...data.cards, newCard], updatedAt: now },
        { expectedUpdatedAt: Number(data.updatedAt || 0) }
      );

      if (result.success) {
        if (refreshData) await refreshData();
        setIsCreateModalOpen(false);
        showToast('创建成功', 'success');
      } else {
        showToast(result.error || '失败', 'error');
      }
    } catch (e: any) {
      showToast(`封面处理失败: ${e?.message || '未知错误'}`, 'error');
    }
  };

  return { isCreateModalOpen, setIsCreateModalOpen, handleCreateSave };
};
