import type { CardData } from '../../types';

export interface PublicCardProps {
  card: CardData;
  href: string;
  state?: unknown;
  tagNameById: Map<string, string>;
  eager?: boolean;
  loadImage?: boolean;
  imageKey?: string;
  sizes?: string;
  className?: string;
}
