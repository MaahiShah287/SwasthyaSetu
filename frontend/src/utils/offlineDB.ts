import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export type OfflineRecordType =
  | 'vaccination_record'
  | 'child_registration'
  | 'follow_up'
  | 'visit_note'
  | 'health_case_report'
  | 'referral_draft'
  | 'profile_update'
  | 'emergency_profile';

export interface SyncQueueItem {
  local_id: string; // Client-side UUID
  user_id: string; // Authenticated user email
  record_type: OfflineRecordType;
  endpoint?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  payload: any;
  created_at: number; // Unix timestamp in ms
  updated_at: number;
  sync_status: SyncStatus;
  retry_count: number;
  error_message?: string;
  server_response?: any;
  server_data?: any; // Populated on CONFLICT
  client_data?: any; // Populated on CONFLICT
}

export interface CachedSnapshot<T = any> {
  key: string;
  data: T;
  cached_at: number;
  user_id: string;
}

export interface OfflineMeta {
  key: string;
  value: any;
  updated_at: number;
}

interface SwasthyaSetuOfflineDB extends DBSchema {
  sync_queue: {
    key: string; // local_id
    value: SyncQueueItem;
    indexes: {
      by_status: SyncStatus;
      by_user: string;
      by_created: number;
      by_type: OfflineRecordType;
    };
  };
  offline_cache: {
    key: string; // composite `${userId}_${key}`
    value: CachedSnapshot;
    indexes: {
      by_user: string;
      by_cached_at: number;
    };
  };
  offline_meta: {
    key: string;
    value: OfflineMeta;
  };
}

const DB_NAME = 'swasthyasetu_offline_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SwasthyaSetuOfflineDB>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<SwasthyaSetuOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SwasthyaSetuOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. sync_queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'local_id' });
          queueStore.createIndex('by_status', 'sync_status');
          queueStore.createIndex('by_user', 'user_id');
          queueStore.createIndex('by_created', 'created_at');
          queueStore.createIndex('by_type', 'record_type');
        }

        // 2. offline_cache store
        if (!db.objectStoreNames.contains('offline_cache')) {
          const cacheStore = db.createObjectStore('offline_cache', { keyPath: 'key' });
          cacheStore.createIndex('by_user', 'user_id');
          cacheStore.createIndex('by_cached_at', 'cached_at');
        }

        // 3. offline_meta store
        if (!db.objectStoreNames.contains('offline_meta')) {
          db.createObjectStore('offline_meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ==========================================
// SYNC QUEUE OPERATIONS
// ==========================================

export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, 'sync_status' | 'retry_count' | 'created_at' | 'updated_at'> & {
    sync_status?: SyncStatus;
    retry_count?: number;
    created_at?: number;
    updated_at?: number;
  }
): Promise<SyncQueueItem> {
  const db = await getOfflineDB();
  const now = Date.now();
  const fullItem: SyncQueueItem = {
    ...item,
    sync_status: item.sync_status || 'PENDING',
    retry_count: item.retry_count || 0,
    created_at: item.created_at || now,
    updated_at: item.updated_at || now,
  };
  await db.put('sync_queue', fullItem);
  return fullItem;
}

export async function getPendingQueue(userId?: string): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  const all = await db.getAll('sync_queue');
  return all
    .filter((item) => {
      const isPending = item.sync_status === 'PENDING' || item.sync_status === 'FAILED';
      const userMatches = !userId || item.user_id === userId;
      return isPending && userMatches;
    })
    .sort((a, b) => a.created_at - b.created_at);
}

export async function getAllQueueItems(userId?: string): Promise<SyncQueueItem[]> {
  const db = await getOfflineDB();
  const all = await db.getAll('sync_queue');
  const filtered = userId ? all.filter((item) => item.user_id === userId) : all;
  return filtered.sort((a, b) => b.created_at - a.created_at);
}

export async function getQueueItem(localId: string): Promise<SyncQueueItem | undefined> {
  const db = await getOfflineDB();
  return db.get('sync_queue', localId);
}

export async function updateQueueItem(
  localId: string,
  updates: Partial<SyncQueueItem>
): Promise<SyncQueueItem | null> {
  const db = await getOfflineDB();
  const existing = await db.get('sync_queue', localId);
  if (!existing) return null;

  const updated: SyncQueueItem = {
    ...existing,
    ...updates,
    updated_at: Date.now(),
  };
  await db.put('sync_queue', updated);
  return updated;
}

export async function deleteQueueItem(localId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('sync_queue', localId);
}

export async function clearSyncedItems(userId?: string): Promise<number> {
  const db = await getOfflineDB();
  const all = await db.getAll('sync_queue');
  let count = 0;
  for (const item of all) {
    if (item.sync_status === 'SYNCED' && (!userId || item.user_id === userId)) {
      await db.delete('sync_queue', item.local_id);
      count++;
    }
  }
  return count;
}

// ==========================================
// OFFLINE CACHE OPERATIONS (Read-Only Snapshots)
// ==========================================

function makeCacheKey(key: string, userId: string = 'global'): string {
  return `${userId}__${key}`;
}

export async function setCachedSnapshot<T = any>(
  key: string,
  data: T,
  userId: string = 'global'
): Promise<void> {
  try {
    const db = await getOfflineDB();
    const compositeKey = makeCacheKey(key, userId);
    await db.put('offline_cache', {
      key: compositeKey,
      data,
      cached_at: Date.now(),
      user_id: userId,
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to set cached snapshot:', err);
  }
}

export async function getCachedSnapshot<T = any>(
  key: string,
  userId: string = 'global'
): Promise<CachedSnapshot<T> | null> {
  try {
    const db = await getOfflineDB();
    const compositeKey = makeCacheKey(key, userId);
    const cached = await db.get('offline_cache', compositeKey);
    return (cached as CachedSnapshot<T>) || null;
  } catch (err) {
    console.warn('[OfflineDB] Failed to retrieve cached snapshot:', err);
    return null;
  }
}

export async function clearOfflineCache(userId?: string): Promise<void> {
  const db = await getOfflineDB();
  if (!userId) {
    await db.clear('offline_cache');
  } else {
    const all = await db.getAll('offline_cache');
    for (const item of all) {
      if (item.user_id === userId) {
        await db.delete('offline_cache', item.key);
      }
    }
  }
}

// ==========================================
// METADATA STORE (Timestamps, counts)
// ==========================================

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getOfflineDB();
  await db.put('offline_meta', {
    key,
    value,
    updated_at: Date.now(),
  });
}

export async function getMeta<T = any>(key: string): Promise<T | null> {
  const db = await getOfflineDB();
  const entry = await db.get('offline_meta', key);
  return entry ? (entry.value as T) : null;
}
