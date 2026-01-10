import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Calendar, Clock, RefreshCw, AlertCircle, Edit2, Loader2, ChevronDown } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { Button, ImagePreview, Rating, Modal, Input, TextArea, useToast } from './Common';
import { webdav } from '../services/webdavService';

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
  const [editingCard, setEditingCard] = useState<Partial<CardData>>({});
  const [saving, setSaving] = useState(false);
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
    // 如果历史记录长度大于1，说明有上一页，可以使用 -1
    // 否则（例如新标签页打开），直接跳转回首页
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleEditClick = () => {
    if (card) {
      setEditingCard({ ...card });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editingCard.id) return;
    setSaving(true);
    
    const newCards = [...data.cards];
    const idx = newCards.findIndex(c => c.id === editingCard.id);
    if (idx !== -1) {
      newCards[idx] = { 
        ...editingCard, 
        updatedAt: Date.now() 
      } as CardData;
    }

    const newData = { ...data, cards: newCards };
    const result = await webdav.savePublicData(newData);
    
    if (result.success) {
      if (refreshData) await refreshData();
      showToast('更新成功', 'success');
      setIsEditing(false);
    } else {
      showToast(`保存失败: ${result.error}`, 'error');
    }
    setSaving(false);
  };

  if (!card) return <div className="h-screen flex flex-col items-center justify-center gap-4 text-subtle">
    <AlertCircle size={48} className="opacity-20" />
    <p>该档案不存在或已被移除</p>
    <Button onClick={() => navigate('/')} variant="outline">返回首页</Button>
  </div>;

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-ink selection:text-white">
      {/* 顶部导航 (修改：内部增加 max-w-7xl 容器，对齐主体内容) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-stone-100 z-50">
        <div className="max-w-7xl mx-auto h-full px-6 lg:px-12 flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 text-ink hover:gap-3 transition-all font-bold text-sm">
            <ArrowLeft size={18} />
            <span>返回</span>
          </button>
          <div className="flex items-center gap-3">
             <img src={data.settings.iconUrl} alt="Logo" className="w-6 h-6 rounded object-cover" />
             <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{data.settings.title}</span>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 mt-12">
          {/* 上半部分：图片 + 核心信息 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            
            {/* 封面列：移动端在下(order-last)，桌面端在左(order-first) */}
            <div className="space-y-6 order-last lg:order-first">
               {/* 阴影修改：未推荐时使用 shadow-md (垂直约4px)，替代 shadow-2xl */}
               <div className={`aspect-video rounded-3xl overflow-hidden transition-all duration-300 relative ${card.isRecommended ? 'border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' : 'border border-stone-100 shadow-md'}`}>
                 <ImagePreview src={card.coverUrl} alt={card.title} className="w-full h-full" />
                 
                 {/* 桌面端点赞图标 (保留在左上角，保留动画) */}
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
                 
                 {isAdmin && (
                   <button 
                    onClick={handleEditClick}
                    className="absolute top-6 right-6 bg-white/90 hover:bg-white text-ink p-3 rounded-2xl shadow-xl backdrop-blur transition-all hover:scale-110 z-20 group"
                   >
                     <Edit2 size={20} className="group-hover:text-blue-600 transition-colors" />
                   </button>
                 )}
               </div>
            </div>

            {/* 信息列：移动端在上(order-first)，桌面端在右(order-last) */}
            <div className="flex flex-col justify-center space-y-8 order-first lg:order-last">
              <div className="space-y-2">
                 <div className="flex flex-wrap gap-2 mb-4">
                    {card.tagIds.map(tid => (
                      <span key={tid} className="px-3 py-1 bg-stone-100 text-stone-500 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                        {data.tags.find(t => t.id === tid)?.name}
                      </span>
                    ))}
                 </div>
                 
                 <div className="flex items-start gap-3">
                    {/* 移动端点赞图标 (标题前方，无动画) */}
                    {card.isRecommended && (
                       <ThumbsUp 
                         size={32} 
                         className="lg:hidden text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] fill-amber-400 shrink-0 mt-1.5" 
                         strokeWidth={3}
                         stroke="white"
                         style={{ transform: 'rotate(-10deg)' }}
                       />
                    )}
                    <h1 className="text-4xl lg:text-5xl font-black text-ink leading-tight tracking-tight">{card.title}</h1>
                 </div>
              </div>

              {/* 评分与时间 (垂直排列) */}
              <div className="flex flex-col gap-6 items-start">
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block">个人评分</span>
                    <div className="flex items-center gap-3">
                      <Rating value={card.rating} />
                      <span className="text-xl font-black text-amber-500">{card.rating}</span>
                    </div>
                 </div>
                 
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
          <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100/50">
             <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-4">感想</span>
             <div className="text-lg text-ink leading-relaxed whitespace-pre-wrap font-medium">
               {card.description || <span className="text-stone-300 italic">暂无详细描述信息。</span>}
             </div>
          </div>

          {/* 底部元数据 (减少间距 mt-6) */}
          <div className="mt-6 pt-0 flex flex-wrap gap-8 items-center text-[10px] font-bold text-stone-300 uppercase tracking-[0.2em]">
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

        {/* 编辑模态框 (仅管理员) */}
        <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="快速编辑记录">
          <div className="space-y-8">
            <Input label="标题" value={editingCard.title || ''} onChange={e => setEditingCard({...editingCard, title: e.target.value})} className="h-11 text-base" />
            
            <div className="flex items-end gap-6">
              <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-subtle uppercase tracking-wider">分类</label>
                  <div className="relative">
                    <select
                      value={editingCard.tagIds?.[0] || ''}
                      onChange={e => setEditingCard({...editingCard, tagIds: e.target.value ? [e.target.value] : []})}
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-ink appearance-none focus:outline-none focus:border-ink focus:ring-4 focus:ring-stone-100 transition-all"
                    >
                      <option value="" disabled>选择分类...</option>
                      {data.tags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
              </div>
              <div className="flex flex-col items-center gap-2 pb-1">
                <label className="text-xs font-bold text-stone-400 uppercase">推荐</label>
                <input type="checkbox" checked={!!editingCard.isRecommended} onChange={e => setEditingCard({...editingCard, isRecommended: e.target.checked})} className="w-6 h-6 rounded border-stone-300 text-amber-500 focus:ring-amber-400" />
              </div>
            </div>

            <div className="space-y-5">
              <Input label="封面链接 (URL)" value={editingCard.coverUrl || ''} onChange={e => setEditingCard({...editingCard, coverUrl: e.target.value})} className="h-11" />
              <div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-stone-400 uppercase">评分</label><input type="range" min="0" max="5" step="0.5" className="flex-1 accent-ink h-2 bg-stone-100 rounded-lg appearance-none" value={editingCard.rating || 0} onChange={e => setEditingCard({...editingCard, rating: parseFloat(e.target.value)})} /><span className="text-sm font-bold text-ink w-8">{editingCard.rating}</span></div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <Input label="开始日期" type="date" max="9999-12-31" value={editingCard.startDate || ''} onChange={e => { const val = e.target.value; if (val.split('-')[0].length <= 4) setEditingCard({...editingCard, startDate: val}); }} className="h-11" />
              <Input label="结束日期" type="date" max="9999-12-31" value={editingCard.endDate || ''} onChange={e => { const val = e.target.value; if (val.split('-')[0].length <= 4) setEditingCard({...editingCard, endDate: val}); }} className="h-11" />
            </div>

            <TextArea label="详细描述" value={editingCard.description || ''} onChange={e => setEditingCard({...editingCard, description: e.target.value})} className="min-h-[120px] text-base" />
            <Button onClick={handleSave} className="w-full h-14 rounded-2xl text-base" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : '保存修改'}
            </Button>
          </div>
        </Modal>
      </main>
    </div>
  );
}