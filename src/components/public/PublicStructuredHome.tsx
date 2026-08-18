import React from 'react';
import { Clock3, PlayCircle } from 'lucide-react';
import type { CardData, Tag } from '../../types';
import type { StructuredHomeSections } from '../../hooks/useStructuredHomeSections';
import { PublicHero } from './PublicHero';
import { DeferredPublicShelf } from './DeferredPublicShelf';
import { getTagIcon } from '../../utils/tagIcons';
import { getTagSlug } from '../../utils/routeUtils';

interface HeroProps {
  showHero: boolean;
  heroCards: CardData[];
  heroIndex: number;
  previousHeroIndex: number | null;
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

export const resolveShelfEagerCount = (showHero: boolean, shelfIndex: number) => {
  if (shelfIndex < 0) return 0;
  if (!showHero) return shelfIndex === 0 ? 2 : 0;
  return shelfIndex < 2 ? 1 : 0;
};

export const shouldDeferShelf = (shelfIndex: number) => shelfIndex >= 2;

// 剧场首页：全宽 Hero + 各分区横向 shelf
export const PublicStructuredHome: React.FC<PublicStructuredHomeProps> = ({
  sections, gridKey, sectionCardLimit, showHero, heroCards,
  heroIndex, previousHeroIndex, setHeroIndex, setIsHeroPaused, onTouchStart, onTouchMove, onTouchEnd,
  getCardHref, getCardState, onTagChange, tags
}) => {
  const shelfProps = { limit: sectionCardLimit, getCardState, tags };
  const shelfKeys = [
    ...(sections.watchingCards.length > 0 ? ['watching'] : []),
    ...(sections.topCards.length > 0 ? ['top'] : []),
    ...sections.tagSections.map((section) => `tag:${section.tag.id}`)
  ];
  const shelfRuntimeProps = (key: string) => {
    const shelfIndex = shelfKeys.indexOf(key);
    return {
      eagerCount: resolveShelfEagerCount(showHero, shelfIndex),
      defer: shouldDeferShelf(shelfIndex)
    };
  };

  return (
    <div key={`sections-${gridKey}`}>
      {showHero && (
        <PublicHero
          heroCards={heroCards}
          heroIndex={heroIndex}
          previousHeroIndex={previousHeroIndex}
          setHeroIndex={setHeroIndex}
          setIsHeroPaused={setIsHeroPaused}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          getCardHref={(card) => getCardHref(card, 'all')}
          getCardState={getCardState}
        />
      )}

      <div className={`relative px-[var(--page-x)] space-y-10 ${showHero ? 'mt-2' : 'mt-6'}`}>
        {sections.watchingCards.length > 0 && (
          <DeferredPublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-sky-500"><PlayCircle size={22} /></span>}
            title="正在观看"
            cards={sections.watchingCards}
            variant="wide"
            {...shelfRuntimeProps('watching')}
            getCardHref={(card) => getCardHref(card, 'watching')}
            onViewMore={() => onTagChange('watching')}
            {...shelfProps}
          />
        )}

        {sections.topCards.length > 0 && (
          <DeferredPublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]"><Clock3 size={22} /></span>}
            title="最新收录"
            cards={sections.topCards}
            {...shelfRuntimeProps('top')}
            getCardHref={(card) => getCardHref(card, 'all')}
            {...shelfProps}
          />
        )}

        {sections.tagSections.map((section: { tag: Tag; cards: CardData[] }) => (
          <DeferredPublicShelf
            key={section.tag.id}
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]">{getTagIcon(section.tag.icon, 'w-5 h-5') || <span className="text-2xl font-bold leading-none">|</span>}</span>}
            title={section.tag.name}
            cards={section.cards}
            {...shelfRuntimeProps(`tag:${section.tag.id}`)}
            getCardHref={(card) => getCardHref(card, getTagSlug(section.tag))}
            onViewMore={() => onTagChange(section.tag.id)}
            {...shelfProps}
          />
        ))}
      </div>
    </div>
  );
};
