
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useParams, useNavigate } from '../router';
import { ArrowLeft, ThumbsUp, Calendar, AlertCircle, Edit2, PlayCircle, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { PublicData, CardData } from '../types';
import { Button, ImagePreview, Rating, useToast } from './Common';
import { usePublicNavigation } from './public/PublicNavigationContext';
import { useCardCreate, QUICK_CREATE_INITIAL_CARD } from '../hooks/useCardCreate';
import { useDetailBack } from '../hooks/useDetailBack';
import { getCardCoverUrl } from '../utils/cardCover';
import { getCoverAmbientColor } from '../utils/coverAmbientColor';
import { applyPageMetadata } from '../utils/seo';
import { failedResult } from '../domain/persistence';

const CardEditModal = React.lazy(() => import('./CardEditModal').then((m) => ({ default: m.CardEditModal })));

interface PublicDetailProps {
  data: PublicData;
  refreshData?: () => Promise<void>;
  isAdmin: boolean;
}

export const PublicDetail: React.FC<PublicDetailProps> = ({ data, refreshData, isAdmin }) => {
  const { id, section } = useParams();
  const navigate = useNavigate();
  const card = data.cards.find(c => c.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [isOriginalPreviewOpen, setIsOriginalPreviewOpen] = useState(false);
  const [ambient, setAmbient] = useState<string | null>(null);
  // 卡片封面宽高比
  const [coverAspect, setCoverAspect] = useState<number | null>(null);
  const { showToast } = useToast();
  const { isCreateModalOpen, setIsCreateModalOpen, handleCreatePersist } = useCardCreate(data, refreshData);
  const { createRequestToken } = usePublicNavigation();
  const handledCreateRequestRef = useRef(createRequestToken);

  useEffect(() => {
    if (createRequestToken === handledCreateRequestRef.current) return;
    handledCreateRequestRef.current = createRequestToken;
    setIsCreateModalOpen(true);
  }, [createRequestToken, setIsCreateModalOpen]);

  const handleCardCoverLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setCoverAspect(img.naturalWidth / img.naturalHeight);
    }
  };

  useEffect(() => {
    if (card) {
      const description = card.description.replace(/[#*_`[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      applyPageMetadata(`${card.title} - ${data.settings.title}`, description || undefined);
    }
    window.scrollTo(0, 0);

    return () => {
      if (data.settings.title) {
        applyPageMetadata(data.settings.title);
      }
    };
  }, [card, data.settings.title]);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    getCoverAmbientColor(card.id, getCardCoverUrl(card, 'thumb')).then((color) => {
      if (!cancelled && color) setAmbient(color);
    });
    return () => { cancelled = true; };
  }, [card]);

  const handleBack = useDetailBack(section);

  const handlePersist = async (updatedCard: Partial<CardData>) => {
    if (!card) return failedResult('卡片不存在');

    const { refreshAfterCommit, updateCardMutation } = await import('../services/publicDataMutationService');
    const result = await updateCardMutation(data, card, updatedCard);
    if (result.state !== 'persisted') {
      showToast(`保存失败: ${result.error}`, 'error');
      return result;
    }

    const refreshed = await refreshAfterCommit(refreshData);
    showToast(refreshed ? '更新成功' : '更新成功，但页面刷新失败', refreshed ? 'success' : 'info');
    setIsEditing(false);
    return result;
  };

  if (!card) return <div className="h-screen flex flex-col items-center justify-center gap-4 text-[color:var(--text-secondary)]">
    <AlertCircle size={48} className="opacity-20" />
    <p>该档案不存在或已被移除</p>
    <Button onClick={() => navigate('/')} variant="outline">返回首页</Button>
  </div>;

  return (
    <div
      className="relative min-h-screen flex flex-col selection:bg-amber-500/80 selection:text-white dark:selection:bg-amber-200 dark:selection:text-black transition-colors duration-300 hero-ambient"
      style={ambient ? ({ '--ambient': ambient } as React.CSSProperties) : undefined}
    >
      <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={getCardCoverUrl(card, 'thumb')}
          alt=""
          className="w-full h-full object-cover detail-backdrop-img select-none"
          decoding="async"
          draggable={false}
        />
        <div className="absolute inset-0 detail-backdrop-veil" />
      </div>

      <aside
        className="hidden lg:block fixed top-16 bottom-0 z-30 group/detail-back"
        style={{ left: 'max(var(--detail-pad), calc((100vw - var(--detail-max)) / 2 + var(--detail-pad)))', width: 'var(--detail-rail)' }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <button
            onClick={handleBack}
            className="group w-14 aspect-[9/16] opacity-0 group-hover/detail-back:opacity-100 group-focus-within/detail-back:opacity-100 inline-flex items-center justify-center rounded-[1.35rem] bg-[color:color-mix(in_srgb,var(--surface)_52%,transparent)] border border-[color:var(--line)] backdrop-blur-xl text-[color:var(--text-primary)] shadow-[0_18px_48px_rgba(0,0,0,0.22)] hover:bg-[color:var(--accent-soft)] transition-all duration-300"
            title="返回"
          >
            <ArrowLeft size={23} className="transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:scale-110" />
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 pt-8 lg:pt-28 pb-6 lg:pb-10">
        <div className="w-full max-w-[var(--detail-max)] mx-auto px-[var(--detail-pad)] grid grid-cols-1 lg:grid-cols-[var(--detail-rail)_minmax(0,80rem)_var(--detail-rail)] gap-6 lg:gap-[var(--detail-gap)]">
          <div className="hidden lg:block" aria-hidden="true" />
          <div className="min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-7 lg:gap-12 items-center mb-8 lg:mb-12 fade-up">
            <section>
              <div className="relative aspect-video rounded-[1.8rem] overflow-hidden border border-[color:var(--line)] shadow-[var(--shadow-lg)] bg-[color:var(--surface)]">
                <ImagePreview
                  src={getCardCoverUrl(card, 'card')}
                  alt={card.title}
                  className="w-full h-full"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  onLoad={handleCardCoverLoad}
                />

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

            <section className="flex flex-col justify-center gap-5 lg:gap-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--accent)]">Archive · 观影档案</span>
                  {card.tagIds.map(tid => (
                    <span key={tid} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[color:color-mix(in_srgb,var(--surface)_72%,transparent)] border border-[color:var(--line)] backdrop-blur-sm text-[color:var(--text-secondary)]">
                      {data.tags.find(t => t.id === tid)?.name}
                    </span>
                  ))}
                </div>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-[color:var(--text-primary)] leading-tight tracking-tight">{card.title}</h1>
              </div>

              <div className="flex items-end gap-4">
                <span className="font-display text-5xl lg:text-6xl leading-none text-[color:var(--text-primary)]">{(card.rating || 0).toFixed(1)}</span>
                <div className="pb-1 space-y-1.5">
                  <Rating value={card.rating} />
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--text-secondary)]">个人评分</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-[color:var(--text-primary)] font-semibold">
                <Calendar size={15} className="text-[color:var(--text-secondary)]" />
                <span className="text-sm tracking-wide">{card.startDate || '未知'} → {card.endDate || '至今'}</span>
              </div>
            </section>
          </div>

          <section className="glass-panel rounded-[1.6rem] p-6 lg:p-8 fade-up-delay-1">
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
          <div className="hidden lg:block" aria-hidden="true" />
        </div>

      </main>

      <footer className="relative z-10 mt-auto px-5 lg:px-12 pb-8">
        <div className="max-w-7xl mx-auto pt-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3.5 text-[11px] text-[color:var(--text-secondary)]">
          <p className="font-semibold tracking-wide">{data.settings.footerLeft || `© ${new Date().getFullYear()}`}</p>
          <span aria-hidden className="hidden sm:block w-1 h-1 rounded-full bg-[color:color-mix(in_srgb,var(--text-secondary)_40%,transparent)]" />
          <p className="tracking-wide opacity-85">{data.settings.footerRight || data.settings.footerText || 'All rights reserved'}</p>
        </div>
      </footer>

      {isOriginalPreviewOpen && (
        <div
          className="fixed inset-0 z-[2300] bg-black/75 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center"
        >
          <button type="button" aria-label="关闭原图预览" className="absolute inset-0" onClick={() => setIsOriginalPreviewOpen(false)} />
          <div className="relative w-full max-w-6xl">
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
        {isEditing && (
          <CardEditModal
            isOpen
            onClose={() => setIsEditing(false)}
            title="编辑记录"
            initialCard={card}
            tags={data.tags}
            onPersist={handlePersist}
          />
        )}
        {isCreateModalOpen && (
          <CardEditModal
            isOpen
            onClose={() => setIsCreateModalOpen(false)}
            title="快速记录"
            initialCard={QUICK_CREATE_INITIAL_CARD}
            tags={data.tags}
            onPersist={handleCreatePersist}
          />
        )}
      </Suspense>
    </div>
  );
}
