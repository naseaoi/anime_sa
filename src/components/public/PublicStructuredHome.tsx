import React from 'react';
import { Clock3, ThumbsUp, PlayCircle } from 'lucide-react';
import type { CardData, Tag } from '../../types';
import type { StructuredHomeSections } from '../../hooks/useStructuredHomeSections';
import { PublicHero } from './PublicHero';
import { PublicShelf } from './PublicShelf';
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

// 剧场首页：全宽 Hero + 各分区横向 shelf
export const PublicStructuredHome: React.FC<PublicStructuredHomeProps> = ({
  sections, gridKey, sectionCardLimit, showHero, heroCards,
  heroIndex, setHeroIndex, setIsHeroPaused, onTouchStart, onTouchMove, onTouchEnd,
  getCardHref, getCardState, onTagChange, tags
}) => {
  const shelfProps = { limit: sectionCardLimit, getCardState, tags };

  return (
    <div key={`sections-${gridKey}`}>
      {showHero && (
        <PublicHero
          heroCards={heroCards}
          heroIndex={heroIndex}
          setHeroIndex={setHeroIndex}
          setIsHeroPaused={setIsHeroPaused}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          getCardHref={(card) => getCardHref(card, 'all')}
          getCardState={getCardState}
        />
      )}

      <div className={`relative px-5 md:px-8 lg:px-10 space-y-10 ${showHero ? 'mt-2' : 'mt-6'}`}>
        {sections.topCards.length > 0 && (
          <PublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]"><Clock3 size={22} /></span>}
            title="最新收录"
            cards={sections.topCards}
            getCardHref={(card) => getCardHref(card, 'all')}
            {...shelfProps}
          />
        )}

        {sections.recommendedCards.length > 0 && (
          <PublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-amber-500"><ThumbsUp size={22} /></span>}
            title="精选推荐"
            cards={sections.recommendedCards}
            getCardHref={(card) => getCardHref(card, 'recommended')}
            onViewMore={() => onTagChange('recommended')}
            {...shelfProps}
          />
        )}

        {sections.watchingCards.length > 0 && (
          <PublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-sky-500"><PlayCircle size={22} /></span>}
            title="正在观看"
            cards={sections.watchingCards}
            getCardHref={(card) => getCardHref(card, 'watching')}
            onViewMore={() => onTagChange('watching')}
            {...shelfProps}
          />
        )}

        {sections.tagSections.map((section: { tag: Tag; cards: CardData[] }) => (
          <PublicShelf
            key={section.tag.id}
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]">{getTagIcon(section.tag.icon, 'w-5 h-5') || <span className="text-2xl font-bold leading-none">|</span>}</span>}
            title={section.tag.name}
            cards={section.cards}
            getCardHref={(card) => getCardHref(card, getTagSlug(section.tag))}
            onViewMore={() => onTagChange(section.tag.id)}
            {...shelfProps}
          />
        ))}
      </div>
    </div>
  );
};
