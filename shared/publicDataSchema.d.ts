import type { PublicData } from '../src/types';

export const PUBLIC_DATA_LIMITS: Readonly<{
  maxTags: number;
  maxCards: number;
  maxTagIdsPerCard: number;
  maxTitleLength: number;
  maxTextLength: number;
  maxAssetUrlLength: number;
  maxLocalAssetLength: number;
  maxDateLength: number;
  maxIdLength: number;
  maxSettingsTitleLength: number;
  maxTagNameLength: number;
  maxTagSlugLength: number;
  maxTagIconLength: number;
  maxFooterLength: number;
  minRating: number;
  maxRating: number;
}>;

export function getPublicDataUpdatedAt(value: unknown): number;
export function normalizePublicDataPayload(value: unknown): PublicData | null;
