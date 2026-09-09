import {
  getPendingQueue,
  updateQueueItem,
  getAllQueueItems,
  setMeta,
  SyncQueueItem,
} from '../utils/offlineDB';
import { offlineApi, SyncResponseItem } from '../api/offlineApi';

export interface SyncExecutionResult {
  synced: number;
  conflicts: number;
  failed: number;
  total: number;
  details: { local_id: string; status: string; message?: string }[];
}

let isSyncRunning = false;

export const syncManager = {
  /**
   * Check if a sync process is actively running
   */
  isSyncing(): boolean {
    return isSyncRunning;
  },

  /**
   * Run synchronization for all eligible pending/failed records
   */
  async syncAll(currentUserEmail?: string): Promise<SyncExecutionResult> {
    if (isSyncRunning) {
      console.log('[SyncManager] Sync already running. Skipping overlapping execution.');
      return { synced: 0, conflicts: 0, failed: 0, total: 0, details: [] };
    }

    isSyncRunning = true;
    const result: SyncExecutionResult = {
      synced: 0,
      conflicts: 0,
      failed: 0,
      total: 0,
      details: [],
    };

    try {
      const pendingItems = await getPendingQueue(currentUserEmail);
      if (pendingItems.length === 0) {
        return result;
      }

      result.total = pendingItems.length;

      // Mark all items as SYNCING in IndexedDB
      for (const item of pendingItems) {
        await updateQueueItem(item.local_id, { sync_status: 'SYNCING' });
      }

      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < pendingItems.length; i += batchSize) {
        const batch = pendingItems.slice(i, i + batchSize);
        try {
          const res = await offlineApi.syncBatch(batch);
          const responseMap = new Map<string, SyncResponseItem>();
          if (res && res.results) {
            for (const r of res.results) {
              responseMap.set(r.local_id, r);
            }
          }

          for (const item of batch) {
            const syncRes = responseMap.get(item.local_id);
            if (!syncRes) {
              // No response for this item: treat as failed
              await updateQueueItem(item.local_id, {
                sync_status: 'FAILED',
                retry_count: item.retry_count + 1,
                error_message: 'No response received from sync server',
              });
              result.failed++;
              result.details.push({ local_id: item.local_id, status: 'FAILED', message: 'No server response' });
              continue;
            }

            if (syncRes.status === 'SYNCED' || syncRes.status === 'DUPLICATE') {
              await updateQueueItem(item.local_id, {
                sync_status: 'SYNCED',
                server_response: syncRes,
                error_message: undefined,
              });
              result.synced++;
              result.details.push({ local_id: item.local_id, status: 'SYNCED', message: syncRes.message });
            } else if (syncRes.status === 'CONFLICT') {
              await updateQueueItem(item.local_id, {
                sync_status: 'CONFLICT',
                server_data: syncRes.server_data,
                client_data: syncRes.client_data || item.payload,
                error_message: syncRes.message,
              });
              result.conflicts++;
              result.details.push({ local_id: item.local_id, status: 'CONFLICT', message: syncRes.message });
            } else {
              // FAILED
              await updateQueueItem(item.local_id, {
                sync_status: 'FAILED',
                retry_count: item.retry_count + 1,
                error_message: syncRes.error_message || syncRes.message || 'Sync failed on server',
              });
              result.failed++;
              result.details.push({ local_id: item.local_id, status: 'FAILED', message: syncRes.error_message });
            }
          }
        } catch (batchErr: any) {
          console.warn('[SyncManager] Batch sync error:', batchErr);
          for (const item of batch) {
            await updateQueueItem(item.local_id, {
              sync_status: 'FAILED',
              retry_count: item.retry_count + 1,
              error_message: batchErr?.message || 'Network error during batch sync',
            });
            result.failed++;
            result.details.push({
              local_id: item.local_id,
              status: 'FAILED',
              message: batchErr?.message,
            });
          }
        }
      }

      await setMeta('last_synced_at', Date.now());

      // Dispatch global event so UI components can refresh data
      window.dispatchEvent(
        new CustomEvent('swasthyasetu:sync_completed', {
          detail: result,
        })
      );
    } finally {
      isSyncRunning = false;
    }

    return result;
  },

  /**
   * Retry a single item by local_id
   */
  async retryItem(localId: string): Promise<SyncResponseItem> {
    const item = await updateQueueItem(localId, { sync_status: 'SYNCING' });
    if (!item) {
      throw new Error('Item not found in sync queue');
    }

    try {
      const res = await offlineApi.syncSingle(item);
      if (res.status === 'SYNCED' || res.status === 'DUPLICATE') {
        await updateQueueItem(localId, {
          sync_status: 'SYNCED',
          server_response: res,
          error_message: undefined,
        });
      } else if (res.status === 'CONFLICT') {
        await updateQueueItem(localId, {
          sync_status: 'CONFLICT',
          server_data: res.server_data,
          client_data: res.client_data || item.payload,
          error_message: res.message,
        });
      } else {
        await updateQueueItem(localId, {
          sync_status: 'FAILED',
          retry_count: item.retry_count + 1,
          error_message: res.error_message || res.message,
        });
      }

      window.dispatchEvent(new CustomEvent('swasthyasetu:sync_completed', { detail: { single: localId, res } }));
      return res;
    } catch (err: any) {
      await updateQueueItem(localId, {
        sync_status: 'FAILED',
        retry_count: item.retry_count + 1,
        error_message: err?.message || 'Network exception on retry',
      });
      throw err;
    }
  },

  /**
   * Resolve a conflicting item
   */
  async resolveConflict(localId: string, resolution: 'USE_CLIENT' | 'USE_SERVER'): Promise<void> {
    await offlineApi.resolveConflict(localId, resolution);
    if (resolution === 'USE_SERVER') {
      await updateQueueItem(localId, { sync_status: 'SYNCED', error_message: 'Resolved (kept server version)' });
    } else {
      await updateQueueItem(localId, { sync_status: 'SYNCED', error_message: 'Resolved (client version pushed)' });
    }
    window.dispatchEvent(new CustomEvent('swasthyasetu:sync_completed', { detail: { resolved: localId } }));
  },
};
