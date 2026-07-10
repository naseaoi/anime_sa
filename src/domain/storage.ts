export const STORAGE_MODES = ['sqlite', 'webdav'] as const;

export type StorageMode = (typeof STORAGE_MODES)[number];

export const isStorageMode = (value: unknown): value is StorageMode => {
  return typeof value === 'string' && STORAGE_MODES.includes(value as StorageMode);
};
