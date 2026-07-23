export type PersistenceResult =
  | { state: 'persisted' }
  | { state: 'conflict'; error: string }
  | { state: 'failed'; error: string };

export type StagedResult = { state: 'staged' };

export const persistedResult = (): PersistenceResult => ({ state: 'persisted' });

export const conflictResult = (error: string): PersistenceResult => ({ state: 'conflict', error });

export const failedResult = (error: string): PersistenceResult => ({ state: 'failed', error });

export const stagedResult = (): StagedResult => ({ state: 'staged' });

export const isPersisted = (result: PersistenceResult) => result.state === 'persisted';
