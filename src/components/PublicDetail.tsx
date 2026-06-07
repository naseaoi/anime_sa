
import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Calendar, AlertCircle, Edit2, PlayCircle, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { PublicData, CardData } from '../types';
import { Button, ImagePreview, Rating, useToast } from './Common';
import { getStorage, checkServerSession } from '../services/storageFactory';
import { persistCardCover } from '../services/coverAssetService';
import { getCardCoverUrl } from '../utils/cardCover';

const CardEditModal = React.lazy(() => import('./CardEditModal').then((m) => ({ default: m.CardEditModal })));

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
  const [isOriginalPreviewOpen, setIsOriginalPreviewOpen] = useState(false);
  // 记录卡片封面的原始宽高比，原图模态框沿用此比例做占位容器，避免加载期间塌缩为 0 高度
  const [coverAspect, setCoverAspect] = useState<number | null>(null);
  const { showToast } = useToast();

  const handleCardCoverLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setCoverAspect(img.naturalWidth / img.naturalHeight);
    }
  };

  useEffect(() => {
    if (card) document.title = `${card.title} - ${data.settings.title}`;
    window.scrollTo(0, 0);

    // Check for admin auth
    checkServerSession().then(setIsAdmin);

    return () => {
      if (data.settings.title) {
        document.title = data.settings.title;
      }
    };
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

    try {
      const mergedCard: CardData = {
        ...card,
        ...updatedCard,
        id: card.id,
        createdAt: card.createdAt,
        updatedAt: Date.now()
      };
      const nextCard = await persistCardCover(mergedCard);

      const newCards = [...data.cards];
      const idx = newCards.findIndex(c => c.id === card.id);
      if (idx !== -1) {
        newCards[idx] = nextCard;
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
    } catch (e: any) {
      showToast(`封面处理失败: ${e?.message || '未知错误'}`, 'error');
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
            <ArrowLeft size={18} className="transition-transform duration-200 group-hover:scale-110" />
          </button>
          <div className="flex items-center gap-3">
            <img src={data.settings.iconUrl} alt="Logo" className="w-7 h-7 rounded-lg object-cover shadow-sm" />
            <span className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.2em]">{data.settings.title}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-[4.5rem] pb-6 lg:pb-10">
        <div className="max-w-7xl mx-auto px-5 lg:px-12 mt-0 lg:mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 lg:gap-10 mb-4 lg:mb-6">
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
                <ImagePreview
                  src={getCardCoverUrl(card, 'card')}
                  alt={card.title}
                  className="w-full h-full"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onLoad={handleCardCoverLoad}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/25 to-transparent pointer-events-none" />

                {getCardCoverUrl(card, 'original') && (
                  <button
                    type="button"
                    onClick={() => setIsOriginalPreviewOpen(true)}
                    className="absolute right-4 bottom-4 z-20 w-8 h-8 rounded-lg bg-[rgba(0,0,0,0.32)] hover:bg-[rgba(0,0,0,0.46)] border border-white/20 text-white inline-flex items-center justify-center transition-colors"
                    title="查看原图"
                  >
                    <Maximize2 size={13} />
                  </button>
                )}

                {(card.isRecommended || card.isWatching) && (
                  <div className="absolute top-4 left-4 rounded-xl px-3 py-2 bg-black/45 border border-white/20 backdrop-blur-md text-white flex items-center gap-2">
                    {card.isRecommended ? <ThumbsUp size={16} className="text-amber-300" /> : <PlayCircle size={16} className="text-sky-300" />}
                    <span className="text-xs font-semibold tracking-wide">{card.isRecommended ? '推荐' : '正在观看'}</span>
                  </div>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-lg bg-[rgba(0,0,0,0.32)] hover:bg-[rgba(0,0,0,0.46)] border border-white/20 text-white inline-flex items-center justify-center transition-colors"
                    title="编辑此卡片"
                  >
                    <Edit2 size={13} />
                  </button>
                )}

              </div>
            </section>

            <section className="order-3 lg:order-none lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:justify-end">
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
                    <span className="text-sm">{card.startDate || '未知'} → {card.endDate || '至今'}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="glass-panel rounded-[1.6rem] p-6 lg:p-8">
            <span className="text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-[0.2em] block mb-4">观后感</span>
            <div className="markdown-body text-base lg:text-lg text-[color:var(--text-primary)] leading-relaxed font-medium">
              {card.description ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{card.description}</ReactMarkdown>
              ) : (
                <span className="text-[color:var(--text-secondary)] italic">暂无观后感。</span>
              )}
            </div>
          </section>
        </div>

      </main>

      <footer className="mt-auto px-5 lg:px-12 pb-8">
        <div className="max-w-7xl mx-auto pt-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3.5 text-[11px] text-[color:var(--text-secondary)]">
          <p className="font-semibold tracking-wide">{data.settings.footerLeft || `© ${new Date().getFullYear()}`}</p>
          <span aria-hidden className="hidden sm:block w-1 h-1 rounded-full bg-[color:var(--text-secondary)]/40" />
          <p className="tracking-wide opacity-85">{data.settings.footerRight || data.settings.footerText || 'All rights reserved'}</p>
        </div>
      </footer>

      {isOriginalPreviewOpen && (
        <div
          className="fixed inset-0 z-[2300] bg-black/75 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center"
          onClick={() => setIsOriginalPreviewOpen(false)}
        >
          <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-white">
              <p className="text-xs tracking-[0.18em] uppercase">原图预览</p>
              <button
                type="button"
                onClick={() => setIsOriginalPreviewOpen(false)}
                className="px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold"
              >
                关闭
              </button>
            </div>
            <div
              className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black/30 max-h-[82vh] mx-auto"
              style={{ aspectRatio: coverAspect ? String(coverAspect) : '16 / 9' }}
            >
              <ImagePreview
                src={getCardCoverUrl(card, 'original')}
                alt={`${card.title} 原图`}
                className="w-full h-full object-contain"
                imageClassName="object-contain"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <CardEditModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          title="编辑记录"
          initialCard={card}
          tags={data.tags}
          onSave={handleSave}
        />
      </Suspense>
    </div>
  );
}
