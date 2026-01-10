
export interface Tag {
  id: string;
  name: string;
}

export interface CardData {
  id: string;
  title: string;
  coverUrl: string;
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
}

export interface PublicData {
  settings: SiteSettings;
  tags: Tag[];
  cards: CardData[];
}

export interface PrivateData {
  username: string;
  password: string;
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