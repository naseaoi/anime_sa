export type PersistenceResult =
  | { state: 'persisted'; revision?: string }
  | { state: 'conflict'; error: string }
  | { state: 'failed'; error: string };

export type StagedResult = { state: 'staged' };

export const persistedResult = (revision?: string): PersistenceResult => ({ state: 'persisted', ...(revision ? { revision } : {}) });

export const conflictResult = (error: string): PersistenceResult => ({ state: 'conflict', error });

export const failedResult = (error: string): PersistenceResult => ({ state: 'failed', error });

export const stagedResult = (): StagedResult => ({ state: 'staged' });

export const isPersisted = (result: PersistenceResult) => result.state === 'persisted';
