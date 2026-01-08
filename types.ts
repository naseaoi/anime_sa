export interface Tag {
  id: string;
  name: string;
}

export interface CardData {
  id: string;
  title: string;
  coverUrl: string;
  startDate: string;
  endDate: string;
  rating: number; // 0-5
  tagIds: string[];
}

export interface SiteSettings {
  title: string;
  iconUrl: string;
}

// Data stored in 'public_data.json'
export interface PublicData {
  settings: SiteSettings;
  tags: Tag[];
  cards: CardData[];
}

// Data stored in 'private_data.json'
export interface PrivateData {
  username: string;
  password: string; // Plaintext for this demo, strictly implies HTTPS/WebDAV security
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
