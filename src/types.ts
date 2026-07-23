import type { normalizePublicDataPayload } from '../shared/publicDataSchema.js';

type NormalizedPublicData = NonNullable<ReturnType<typeof normalizePublicDataPayload>>;

export type PublicData = NormalizedPublicData;
export type Tag = NormalizedPublicData['tags'][number];
export type CardData = NormalizedPublicData['cards'][number];
export type SiteSettings = NormalizedPublicData['settings'];

export interface AdminProfile {
  username: string;
}

export interface AdminCredentialsUpdate {
  username: string;
  newPassword?: string;
}

export interface AuditLogEntry {
  id: string;
  ts: number;
  action: string;
  status: 'success' | 'failed';
  details?: string;
  message?: string;
}

export enum LoginStatus {
  IDLE,
  LOGGED_IN,
  FAILED,
}
