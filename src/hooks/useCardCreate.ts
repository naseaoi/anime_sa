import { useState } from 'react';
import { CardData, PublicData } from '../types';
import { getStorage } from '../services/storageFactory';
import { persistCardCover } from '../services/coverAssetService';
import { useToast } from '../components/Common';
import { createCardData } from '../domain/card';
import { failedResult, persistedResult } from '../domain/persistence';
import { errorMessage } from '../services/apiClient';

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

  const handleCreatePersist = async (cardData: Partial<CardData>) => {
    try {
      const now = Date.now();
      const draftCard = createCardData(cardData, {
        id: now.toString(),
        now,
        defaultTitle: 'Untitled'
      });

      const newCard = await persistCardCover(draftCard);
      const result = await getStorage().savePublicData(
        { ...data, cards: [...data.cards, newCard], updatedAt: now },
        { expectedUpdatedAt: Number(data.updatedAt || 0) }
      );

      if (result.state === 'persisted') {
        if (refreshData) await refreshData();
        setIsCreateModalOpen(false);
        showToast('创建成功', 'success');
        return persistedResult();
      } else {
        showToast(result.error || '失败', 'error');
        return result;
      }
    } catch (error: unknown) {
      const message = errorMessage(error, '未知错误');
      showToast(`封面处理失败: ${message}`, 'error');
      return failedResult(message);
    }
  };

  return { isCreateModalOpen, setIsCreateModalOpen, handleCreatePersist };
};
