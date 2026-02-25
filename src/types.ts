
export interface Tag {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
}

export interface CardData {
  id: string;
  title: string;
  coverUrl: string;
  coverVariants?: {
    thumb?: string;
    card?: string;
    original?: string;
  };
  coverLocalData?: string;
  description: string;
  startDate: string;
  endDate: string;
  rating: number; // 0-5
  tagIds: string[];
  isRecommended: boolean; // 是否推荐
  isWatching?: boolean; // 是否正在观看
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
}

export interface SiteSettings {
  title: string;
  iconUrl: string;
  footerText?: string;
  footerLeft?: string;
  footerRight?: string;
}

export interface PublicData {
  version?: number; // Data version/timestamp
  updatedAt?: number; // Last sync/save timestamp
  settings: SiteSettings;
  tags: Tag[];
  cards: CardData[];
}

export interface PrivateData {
  username: string;
  password?: string;
  passwordHash?: string;
  passwordUpdatedAt?: number;
}

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

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  path: string;
}

export enum LoginStatus {
  IDLE,
  LOGGED_IN,
  FAILED,
}
