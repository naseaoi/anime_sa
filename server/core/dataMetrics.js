import { PUBLIC_DATA_LIMITS } from '../publicDataValidation.js';
import { inspectSqliteStorage } from './sqliteMaintenance.js';

export const buildPublicDataMetrics = (value) => {
  const tags = Array.isArray(value?.tags) ? value.tags : [];
  const cards = Array.isArray(value?.cards) ? value.cards : [];
  const jsonBytes = Buffer.byteLength(JSON.stringify(value || {}), 'utf8');
  return {
    model: 'document-kv-v1',
    tags: tags.length,
    cards: cards.length,
    jsonBytes,
    limits: {
      maxTags: PUBLIC_DATA_LIMITS.maxTags,
      maxCards: PUBLIC_DATA_LIMITS.maxCards,
      maxJsonBytes: 1024 * 1024
    },
    utilization: {
      tags: tags.length / PUBLIC_DATA_LIMITS.maxTags,
      cards: cards.length / PUBLIC_DATA_LIMITS.maxCards,
      jsonBytes: jsonBytes / (1024 * 1024)
    }
  };
};

export const buildSqliteDataMetrics = (database, value) => ({
  ...buildPublicDataMetrics(value),
  storage: {
    driver: 'sqlite',
    ...inspectSqliteStorage(database)
  }
});
