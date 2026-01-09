import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Calendar, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { PublicData } from '../types';
import { Button, ImagePreview, Rating } from './Common';

export const PublicDetail: React.FC<{ data: PublicData }> = ({ data }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const card = data.cards.find(c => c.id === id);

  useEffect(() => {
    if (card) document.title = `${card.title} - ${data.settings.title}`;
    window.scrollTo(0, 0);
  }, [card, data.settings.title]);

  if (!card) return <div className="h-screen flex flex-col items-center justify-center gap-4 text-subtle">
    <AlertCircle size={48} className="opacity-20" />
    <p>该档案不存在或已被移除</p>
    <Button onClick={() => navigate('/')} variant="outline">返回首页</Button>
  </div>;

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-ink selection:text-white">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-stone-100 z-50 flex items-center justify-between px-6 lg:px-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-ink hover:gap-3 transition-all font-bold text-sm">
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>
        <div className="flex items-center gap-3">
           <img src={data.settings.iconUrl} alt="Logo" className="w-6 h-6 rounded object-cover" />
           <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{data.settings.title}</span>
        </div>
      </header>

      <main className="pt-16 pb-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 mt-12">
          {/* 上半部分：图片 + 核心信息 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
               <div className={`aspect-video rounded-3xl overflow-hidden transition-all duration-300 relative ${card.isRecommended ? 'border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' : 'border border-stone-100 shadow-2xl'}`}>
                 <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full" />
                 {card.isRecommended && (
                   <div className="absolute top-6 left-6 bg-amber-400 text-white p-3 rounded-2xl shadow-xl flex items-center justify-center animate-in zoom-in duration-500">
                      <ThumbsUp size={24} />
                   </div>
                 )}
               </div>
            </div>

            <div className="flex flex-col justify-center space-y-8">
              <div className="space-y-2">
                 <div className="flex flex-wrap gap-2 mb-4">
                    {card.tagIds.map(tid => (
                      <span key={tid} className="px-3 py-1 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                        {data.tags.find(t => t.id === tid)?.name}
                      </span>
                    ))}
                 </div>
                 <h1 className="text-4xl lg:text-5xl font-black text-ink leading-tight tracking-tight">{card.title}</h1>
              </div>

              <div className="flex items-center gap-10">
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">个人评分</span>
                    <div className="flex items-center gap-3">
                      <Rating value={card.rating} />
                      <span className="text-xl font-black text-amber-500">{card.rating}</span>
                    </div>
                 </div>
                 <div className="h-8 w-px bg-stone-100" />
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">时间周期</span>
                    <div className="flex items-center gap-2 text-ink font-bold">
                      <Calendar size={14} className="text-stone-300" />
                      <span className="text-sm">{card.startDate || '未知'} — {card.endDate || '至今'}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          {/* 下半部分：详细描述 */}
          <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100/50">
             <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-4">感想</span>
             <div className="text-lg text-ink leading-relaxed whitespace-pre-wrap font-medium">
               {card.description || <span className="text-stone-300 italic">暂无详细描述信息。</span>}
             </div>
          </div>

          {/* 底部元数据 */}
          <div className="mt-16 pt-12 border-t border-stone-100 flex flex-wrap gap-8 items-center text-[10px] font-bold text-stone-300 uppercase tracking-[0.2em]">
             <div className="flex items-center gap-2">
                <Clock size={12} />
                <span>创建于 {new Date(card.createdAt).toLocaleDateString()}</span>
             </div>
             {card.updatedAt !== card.createdAt && (
               <div className="flex items-center gap-2">
                  <RefreshCw size={12} />
                  <span>最后更新 {new Date(card.updatedAt).toLocaleDateString()}</span>
               </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}
