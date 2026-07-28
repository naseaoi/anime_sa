import { useState } from 'react';
import { CardData, PublicData } from '../types';
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

  const handleCreatePersist = async (cardData: Partial<CardData>) => {
    const { createCardMutation, refreshAfterCommit } = await import('../services/publicDataMutationService');
    const result = await createCardMutation(data, cardData);
    if (result.state !== 'persisted') {
      showToast(result.error || '失败', 'error');
      return result;
    }

    const refreshed = await refreshAfterCommit(refreshData);
    setIsCreateModalOpen(false);
    showToast(refreshed ? '创建成功' : '创建成功，但页面刷新失败', refreshed ? 'success' : 'info');
    return result;
  };

  return { isCreateModalOpen, setIsCreateModalOpen, handleCreatePersist };
};
