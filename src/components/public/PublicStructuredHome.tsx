import React, { useMemo, useRef } from 'react';
import { Clock3, PlayCircle } from 'lucide-react';
import type { CardData, Tag } from '../../types';
import type { StructuredHomeSections } from '../../hooks/useStructuredHomeSections';
import { PublicHero } from './PublicHero';
import { PublicShelf } from './PublicShelf';
import { getTagIcon } from '../../utils/tagIcons';
import { getTagSlug } from '../../utils/routeUtils';
import { useViewportImageKeys } from '../../hooks/useViewportImageKeys';

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

export const resolveInitialShelfKey = (sections: StructuredHomeSections) => {
  if (sections.watchingCards.length > 0) return 'watching';
  if (sections.topCards.length > 0) return 'top';
  const firstTagId = sections.tagSections[0]?.tag.id;
  return firstTagId ? `tag:${firstTagId}` : null;
};

export const resolveShelfEagerCount = (showHero: boolean, shelfKey: string, firstShelfKey: string | null) => (
  !showHero && firstShelfKey === shelfKey ? 2 : 0
);

// 剧场首页：全宽 Hero + 各分区横向 shelf
export const PublicStructuredHome: React.FC<PublicStructuredHomeProps> = ({
  sections, gridKey, sectionCardLimit, showHero, heroCards,
  heroIndex, setHeroIndex, setIsHeroPaused, onTouchStart, onTouchMove, onTouchEnd,
  getCardHref, getCardState, onTagChange, tags
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const observationKey = useMemo(() => [
    ...heroCards.map((card) => card.id),
    ...sections.watchingCards.slice(0, sectionCardLimit).map((card) => card.id),
    ...sections.topCards.slice(0, sectionCardLimit).map((card) => card.id),
    ...sections.tagSections.flatMap((section) => section.cards.slice(0, sectionCardLimit).map((card) => card.id))
  ].join('|'), [heroCards, sections, sectionCardLimit]);
  const visibleImageKeys = useViewportImageKeys(contentRef, observationKey);
  const shelfProps = { limit: sectionCardLimit, getCardState, tags, visibleImageKeys };
  const firstShelfKey = resolveInitialShelfKey(sections);
  const eagerCountFor = (key: string) => resolveShelfEagerCount(showHero, key, firstShelfKey);

  return (
    <div ref={contentRef} key={`sections-${gridKey}`}>
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
          visibleImageKeys={visibleImageKeys}
        />
      )}

      <div className={`relative px-[var(--page-x)] space-y-10 ${showHero ? 'mt-2' : 'mt-6'}`}>
        {sections.watchingCards.length > 0 && (
          <PublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-sky-500"><PlayCircle size={22} /></span>}
            title="正在观看"
            cards={sections.watchingCards}
            variant="wide"
            eagerCount={eagerCountFor('watching')}
            getCardHref={(card) => getCardHref(card, 'watching')}
            onViewMore={() => onTagChange('watching')}
            {...shelfProps}
          />
        )}

        {sections.topCards.length > 0 && (
          <PublicShelf
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]"><Clock3 size={22} /></span>}
            title="最新收录"
            cards={sections.topCards}
            eagerCount={eagerCountFor('top')}
            getCardHref={(card) => getCardHref(card, 'all')}
            {...shelfProps}
          />
        )}

        {sections.tagSections.map((section: { tag: Tag; cards: CardData[] }) => (
          <PublicShelf
            key={section.tag.id}
            icon={<span className="w-6 h-6 inline-flex items-center justify-center text-[color:var(--accent)]">{getTagIcon(section.tag.icon, 'w-5 h-5') || <span className="text-2xl font-bold leading-none">|</span>}</span>}
            title={section.tag.name}
            cards={section.cards}
            eagerCount={eagerCountFor(`tag:${section.tag.id}`)}
            getCardHref={(card) => getCardHref(card, getTagSlug(section.tag))}
            onViewMore={() => onTagChange(section.tag.id)}
            {...shelfProps}
          />
        ))}
      </div>
    </div>
  );
};
