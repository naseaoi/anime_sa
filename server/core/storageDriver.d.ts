export declare const STORAGE_DRIVERS: string[];
export declare function resolveStorageDriver(env: Record<string, string | undefined>): 'sqlite' | 'redis';
export declare function listAvailableDrivers(env: Record<string, string | undefined>): Array<'sqlite' | 'redis'>;
