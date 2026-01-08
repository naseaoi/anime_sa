export interface Tag {
  id: string;
  name: string;
}

export interface CardData {
  id: string;
  title: string;
  coverUrl: string;
  description: string; // 新增：详细信息
  startDate: string;
  endDate: string;
  rating: number; // 0-5
  tagIds: string[];
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