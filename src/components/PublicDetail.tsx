
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Calendar, AlertCircle, Edit2, PlayCircle } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { Button, ImagePreview, Rating, useToast } from './Common';
import { CardEditModal } from './CardEditModal';
import { getStorage } from '../services/storageFactory';

interface PublicDetailProps {
  data: PublicData;
  refreshData?: () => Promise<void>;
}

export const PublicDetail: React.FC<PublicDetailProps> = ({ data, refreshData }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const card = data.cards.find(c => c.id === id);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (card) document.title = `${card.title} - ${data.settings.title}`;
    window.scrollTo(0, 0);

    // Check for admin auth
    const expiry = localStorage.getItem('tat_expiry');
    if (expiry && new Date().getTime() < parseInt(expiry)) {
      setIsAdmin(true);
    }
  }, [card, data.settings.title]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleSave = async (updatedCard: Partial<CardData>) => {
    if (!card) return;
    
    const newCards = [...data.cards];
    const idx = newCards.findIndex(c => c.id === card.id);
    if (idx !== -1) {
      newCards[idx] = { 
        ...updatedCard, 
        id: card.id, // 确保ID不被覆盖
        updatedAt: Date.now() 
      } as CardData;
    }

    const newData = { ...data, cards: newCards };
    const webdav = getStorage();
    const result = await webdav.savePublicData(newData);
    
    if (result.success) {
      if (refreshData) await refreshData();
      showToast('更新成功', 'success');
      setIsEditing(false);
    } else {
      showToast(`保存失败: ${result.error}`, 'error');
    }
  };

  if (!card) return <div className="h-screen flex flex-col items-center justify-center gap-4 text-subtle dark:text-zinc-400">
    <AlertCircle size={48} className="opacity-20" />
    <p>该档案不存在或已被移除</p>
    <Button onClick={() => navigate('/')} variant="outline">返回首页</Button>
  </div>;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0c] font-sans selection:bg-ink selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-300">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-[#0c0c0c]/80 backdrop-blur-xl border-b border-stone-100 dark:border-zinc-800 z-50">
        <div className="max-w-7xl mx-auto h-full px-6 lg:px-12 flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 text-ink dark:text-zinc-200 hover:gap-3 transition-all font-bold text-sm">
            <ArrowLeft size={18} />
            <span>返回</span>
          </button>
          <div className="flex items-center gap-3">
             <img src={data.settings.iconUrl} alt="Logo" className="w-6 h-6 rounded object-cover" />
             <span className="text-xs font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-widest">{data.settings.title}</span>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-12 lg:pb-24">
        {/* 间距调整：移动端 mt-6，桌面端 mt-12 */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 mt-6 lg:mt-12">
          {/* 上半部分：图片 + 核心信息 */}
          {/* 间距调整：移动端 gap-6 mb-8，桌面端 gap-12 mb-12 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-8 lg:mb-12">
            
            {/* 封面列 */}
            <div className="space-y-6 order-last lg:order-first">
               <div className={`aspect-video rounded-3xl overflow-hidden transition-all duration-300 relative ${card.isWatching ? 'border-2 border-dashed border-blue-400 dark:border-blue-700' : card.isRecommended ? 'border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' : 'border border-stone-100 dark:border-zinc-800 shadow-md'}`}>
                 <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full" />
                 
                 {/* 桌面端状态图标 */}
                 {card.isRecommended && (
                   <div className="hidden lg:block absolute top-6 left-6 z-10 animate-in zoom-in duration-500">
                      <style>{`
                        @keyframes thumb-up-bounce {
                          0% { transform: scale(1) rotate(-10deg); }
                          25% { transform: scale(1.05) rotate(-15deg); }
                          45% { transform: scale(0.98) rotate(-8deg); }
                          60% { transform: scale(1.02) rotate(-12deg); }
                          100% { transform: scale(1) rotate(-10deg); }
                        }
                      `}</style>
                      <ThumbsUp 
                        size={48} 
                        className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] fill-amber-400" 
                        strokeWidth={2}
                        stroke="white"
                        style={{ animation: 'thumb-up-bounce 1.5s ease-in-out infinite', transformOrigin: 'bottom left' }}
                      />
                   </div>
                 )}
                 {card.isWatching && !card.isRecommended && (
                    <div className="hidden lg:block absolute top-6 left-6 z-10 animate-in zoom-in duration-500">
                       <PlayCircle size={48} className="text-blue-500 fill-white/50 drop-shadow-md" />
                    </div>
                 )}
                 
                 {/* 管理员编辑按钮 - 样式优化 */}
                 {isAdmin && (
                   <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute top-0 right-0 bg-ink/90 hover:bg-ink dark:bg-black/90 dark:hover:bg-black text-white p-3 rounded-bl-2xl shadow-lg backdrop-blur transition-all z-20 group"
                    title="编辑此卡片"
                   >
                     <Edit2 size={20} className="group-hover:rotate-12 transition-transform" />
                   </button>
                 )}
               </div>
            </div>

            {/* 信息列 */}
            {/* 间距调整：移动端 space-y-4，桌面端 space-y-8 */}
            <div className="flex flex-col justify-center space-y-4 lg:space-y-8 order-first lg:order-last">
              <div className="space-y-2">
                 <div className="flex flex-wrap gap-2 mb-2 lg:mb-4">
                    {card.tagIds.map(tid => (
                      <span key={tid} className="px-3 py-1 bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-300 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                        {data.tags.find(t => t.id === tid)?.name}
                      </span>
                    ))}
                 </div>
                 
                 <div className="flex items-start gap-3">
                    {/* 移动端状态图标 */}
                    {card.isRecommended && (
                       <ThumbsUp 
                         size={28} 
                         className="lg:hidden text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] fill-amber-400 shrink-0 mt-1.5" 
                         strokeWidth={3}
                         stroke="white"
                         style={{ transform: 'rotate(-10deg)' }}
                       />
                    )}
                    {card.isWatching && !card.isRecommended && (
                       <PlayCircle size={28} className="lg:hidden text-blue-500 fill-blue-100 shrink-0 mt-1.5" />
                    )}
                    <h1 className="text-3xl lg:text-5xl font-black text-ink dark:text-white leading-tight tracking-tight">{card.title}</h1>
                 </div>
              </div>

              {/* 评分与时间 */}
              <div className="flex flex-col gap-4 lg:gap-6 items-start">
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-widest block">个人评分</span>
                    <div className="flex items-center gap-3">
                      <Rating value={card.rating} />
                      <span className="text-xl font-black text-amber-500">{(card.rating || 0).toFixed(1)}</span>
                    </div>
                 </div>
                 
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-widest block">时间周期</span>
                    <div className="flex items-center gap-2 text-ink dark:text-zinc-200 font-bold">
                      <Calendar size={14} className="text-stone-300 dark:text-zinc-600" />
                      <span className="text-sm">{card.startDate || '未知'} — {card.endDate || '至今'}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          {/* 下半部分：详细描述 */}
          <div className="bg-stone-50 dark:bg-[#18181b] p-6 rounded-3xl border border-stone-100/50 dark:border-zinc-800/50">
             <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-widest block mb-4">感想</span>
             <div className="text-base lg:text-lg text-ink dark:text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium">
               {card.description || <span className="text-stone-300 dark:text-zinc-600 italic">暂无详细描述信息。</span>}
             </div>
          </div>
        </div>

        {/* 使用通用的编辑模态框 */}
        <CardEditModal 
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          title="编辑记录"
          initialCard={card}
          tags={data.tags}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
