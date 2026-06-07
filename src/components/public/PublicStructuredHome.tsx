import React from 'react';
import { ThumbsUp, PlayCircle, ChevronRight } from 'lucide-react';
import type { CardData, Tag } from '../../types';
import type { StructuredHomeSections } from '../../hooks/useStructuredHomeSections';
import { PublicCardGrid } from './PublicCardGrid';
import { getTagIcon } from '../../utils/tagIcons';
import { getTagSlug } from '../../utils/routeUtils';

interface HeroProps {
  showHero: boolean;
  heroCards: CardData[];
  heroIndex: number;
  setHeroIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsHeroPaused: React.Dispatch<React.SetStateAction<boolean>>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface PublicStructuredHomeProps extends HeroProps {
  sections: StructuredHomeSections;
  gridKey: string;
  sectionCardLimit: number;
  getCardHref: (card: CardData, forcedSection: string) => string;
  getCardState: () => { from: string };
  onTagChange: (tagId: string) => void;
  tags: Tag[];
}

// 非首屏分区的通用壳：标题 + 计数 + "查看更多" + 卡片网格
interface HomeSectionProps {
  icon: React.ReactNode;
  titleClassName?: string;
  title: string;
  cards: CardData[];
  sectionCardLimit: number;
  sectionKey: string;
  gridKey: string;
  setHeroIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsHeroPaused: React.Dispatch<React.SetStateAction<boolean>>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  getCardHref: (card: CardData) => string;
  getCardState: () => { from: string };
  onViewMore: () => void;
  tags: Tag[];
}

const HomeSection: React.FC<HomeSectionProps> = ({
  icon, title, cards, sectionCardLimit,
  sectionKey, gridKey, setHeroIndex, setIsHeroPaused,
  onTouchStart, onTouchMove, onTouchEnd, getCardHref, getCardState, onViewMore, tags
}) => {
  const showViewMore = cards.length > sectionCardLimit;
  return (
    <section className="space-y-4 section-fade-in home-section-visibility">
      <div className="flex items-center justify-between gap-3 section-fade-in">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-2xl text-[color:var(--text-primary)]">{title}</h3>
          <span className="text-xs font-mono text-[color:var(--text-secondary)]">{cards.length}</span>
        </div>
        {showViewMore && (
          <button onClick={onViewMore} className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
            查看更多
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      <PublicCardGrid
        gridKey={`${gridKey}-${sectionKey}`}
        filteredCards={cards.slice(0, sectionCardLimit)}
        visibleCount={Math.min(cards.length, sectionCardLimit)}
        showHero={false}
        heroCards={[]}
        heroIndex={0}
        setHeroIndex={setHeroIndex}
        setIsHeroPaused={setIsHeroPaused}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        getCardHref={getCardHref}
        getCardState={getCardState}
        tags={tags}
      />
      {showViewMore && (
        <div className="flex justify-end pt-2 md:hidden">
          <button onClick={onViewMore} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors">
            查看更多
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
};

export const PublicStructuredHome: React.FC<PublicStructuredHomeProps> = ({
  sections, gridKey, sectionCardLimit, showHero, heroCards,
  heroIndex, setHeroIndex, setIsHeroPaused, onTouchStart, onTouchMove, onTouchEnd,
  getCardHref, getCardState, onTagChange, tags
}) => {
  const gridProps = {
    setHeroIndex,
    setIsHeroPaused,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getCardState,
    tags
  };

  return (
    <div key={`sections-${gridKey}`} className="space-y-12">
      <section className="section-fade-in home-section-visibility">
        <PublicCardGrid
          gridKey={`${gridKey}-hero-block`}
          filteredCards={sections.topCards}
          visibleCount={sections.topCards.length}
          showHero={showHero}
          heroCards={heroCards}
          heroIndex={heroIndex}
          getCardHref={(card) => getCardHref(card, 'all')}
          {...gridProps}
        />
      </section>

      {sections.recommendedCards.length > 0 && (
        <HomeSection
          icon={<span className="w-6 h-6 inline-flex items-center justify-center text-amber-500"><ThumbsUp size={24} /></span>}
          title="精选推荐"
          cards={sections.recommendedCards}
          sectionCardLimit={sectionCardLimit}
          sectionKey="recommended-block"
          gridKey={gridKey}
          getCardHref={(card) => getCardHref(card, 'recommended')}
          onViewMore={() => onTagChange('recommended')}
          {...gridProps}
        />
      )}

      {sections.watchingCards.length > 0 && (
        <HomeSection
          icon={<span className="w-6 h-6 inline-flex items-center justify-center text-sky-500"><PlayCircle size={24} /></span>}
          title="正在观看"
          cards={sections.watchingCards}
          sectionCardLimit={sectionCardLimit}
          sectionKey="watching-block"
          gridKey={gridKey}
          getCardHref={(card) => getCardHref(card, 'watching')}
          onViewMore={() => onTagChange('watching')}
          {...gridProps}
        />
      )}

      {sections.tagSections.map((section: { tag: Tag; cards: CardData[] }) => (
        <HomeSection
          key={section.tag.id}
          icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]">{getTagIcon(section.tag.icon, 'w-6 h-6') || <span className="text-2xl font-bold leading-none">|</span>}</span>}
          title={section.tag.name}
          cards={section.cards}
          sectionCardLimit={sectionCardLimit}
          sectionKey={`tag-${section.tag.id}`}
          gridKey={gridKey}
          getCardHref={(card) => getCardHref(card, getTagSlug(section.tag))}
          onViewMore={() => onTagChange(section.tag.id)}
          {...gridProps}
        />
      ))}
    </div>
  );
};
