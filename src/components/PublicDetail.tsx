
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Calendar, AlertCircle, Edit2, PlayCircle } from 'lucide-react';
import { PublicData, CardData } from '../types';
import { Button, ImagePreview, Rating, useToast } from './Common';
import { CardEditModal } from './CardEditModal';
import { getStorage, checkServerSession } from '../services/storageFactory';

interface PublicDetailProps {
  data: PublicData;
  refreshData?: () => Promise<void>;
}

export const PublicDetail: React.FC<PublicDetailProps> = ({ data, refreshData }) => {
  const { id, section } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const card = data.cards.find(c => c.id === id);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (card) document.title = `${card.title} - ${data.settings.title}`;
    window.scrollTo(0, 0);

    // Check for admin auth
    checkServerSession().then(setIsAdmin);
  }, [card, data.settings.title]);

  const handleBack = () => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from.startsWith('/')) {
      navigate(from, { replace: true });
      return;
    }

    const fromSameOrigin = !!document.referrer && document.referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && fromSameOrigin) {
      navigate(-1);
    } else {
      navigate(section && section !== 'all' ? `/${section}` : '/', { replace: true });
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
    <div className="min-h-screen flex flex-col selection:bg-amber-500/80 selection:text-white dark:selection:bg-amber-200 dark:selection:text-black transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-[color:var(--surface-muted)]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-5 lg:px-12 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="group w-10 h-10 inline-flex items-center justify-center rounded-xl text-[color:var(--text-primary)] hover:bg-[color:var(--accent-soft)] transition-all"
            title="返回"
          >
            <ArrowLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:scale-110" />
          </button>
          <div className="flex items-center gap-3">
            <img src={data.settings.iconUrl} alt="Logo" className="w-7 h-7 rounded-lg object-cover shadow-sm" />
            <span className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.2em]">{data.settings.title}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-6 lg:pb-10">
        <div className="max-w-7xl mx-auto px-5 lg:px-12 mt-4 lg:mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 lg:gap-10 mb-8 lg:mb-12">
            <section className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 flex flex-col justify-center gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {card.tagIds.map(tid => (
                    <span key={tid} className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-[color:var(--surface)]/80 border border-[color:var(--line)] text-[color:var(--text-secondary)]">
                      {data.tags.find(t => t.id === tid)?.name}
                    </span>
                  ))}
                </div>
                <h1 className="font-display text-3xl lg:text-5xl text-[color:var(--text-primary)] leading-tight tracking-tight">{card.title}</h1>
              </div>
            </section>

            <section className="order-2 lg:order-none lg:col-start-1 lg:row-span-2">
              <div className={`relative aspect-video rounded-[1.8rem] overflow-hidden border ${card.isWatching ? 'border-sky-300/80 dark:border-sky-400/30 shadow-[0_14px_42px_rgba(56,189,248,0.18)]' : card.isRecommended ? 'border-amber-300/90 dark:border-amber-400/35 shadow-[0_14px_42px_rgba(217,140,38,0.24)]' : 'border-[color:var(--line)] shadow-[0_20px_48px_rgba(0,0,0,0.16)]'}`}>
                <ImagePreview src={card.coverLocalData || card.coverUrl} alt={card.title} className="w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/25 to-transparent pointer-events-none" />

                {(card.isRecommended || card.isWatching) && (
                  <div className="absolute top-4 left-4 rounded-xl px-3 py-2 bg-black/45 border border-white/20 backdrop-blur-md text-white flex items-center gap-2">
                    {card.isRecommended ? <ThumbsUp size={16} className="text-amber-300" /> : <PlayCircle size={16} className="text-sky-300" />}
                    <span className="text-xs font-semibold tracking-wide">{card.isRecommended ? '推荐作品' : '正在观看'}</span>
                  </div>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute top-4 right-4 bg-black/55 hover:bg-black/70 text-white p-2.5 rounded-xl border border-white/20 shadow-lg backdrop-blur transition-all z-20 group"
                    title="编辑此卡片"
                  >
                    <Edit2 size={18} className="group-hover:rotate-12 transition-transform" />
                  </button>
                )}

                <div className="absolute right-4 bottom-4 bg-black/50 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-lg flex items-center gap-2 text-white">
                  <span className="text-[11px] uppercase tracking-[0.14em] opacity-80">Score</span>
                  <span className="text-sm font-semibold">{(card.rating || 0).toFixed(1)}</span>
                </div>
              </div>
            </section>

            <section className="order-3 lg:order-none lg:col-start-2 lg:row-start-2">
              <div className="glass-panel rounded-2xl p-5 lg:p-6 space-y-5">
                <div>
                  <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.2em] block mb-2">个人评分</span>
                  <div className="flex items-center gap-3">
                    <Rating value={card.rating} />
                    <span className="text-2xl font-bold text-amber-500">{(card.rating || 0).toFixed(1)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.2em] block mb-2">时间周期</span>
                  <div className="flex items-center gap-2 text-[color:var(--text-primary)] font-semibold">
                    <Calendar size={15} className="text-[color:var(--text-secondary)]" />
                    <span className="text-sm">{card.startDate || '未知'} - {card.endDate || '至今'}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="glass-panel rounded-[1.6rem] p-6 lg:p-8">
            <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.2em] block mb-4">观后感</span>
            <div className="text-base lg:text-lg text-[color:var(--text-primary)] leading-relaxed whitespace-pre-wrap font-medium">
              {card.description || <span className="text-[color:var(--text-secondary)] italic">暂无详细描述信息。</span>}
            </div>
          </section>
        </div>

      </main>

      <footer className="mt-auto px-5 lg:px-12 pb-6">
        <div className="max-w-7xl mx-auto pt-3 flex items-center justify-center text-xs text-[color:var(--text-secondary)]">
          <p className="font-semibold text-center">{data.settings.footerLeft || `© ${new Date().getFullYear()}`}</p>
        </div>
      </footer>

      <CardEditModal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title="编辑记录"
        initialCard={card}
        tags={data.tags}
        onSave={handleSave}
      />
    </div>
  );
}
