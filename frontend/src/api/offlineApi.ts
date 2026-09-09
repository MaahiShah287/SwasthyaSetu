import api from './instance';
import { SyncQueueItem } from '../utils/offlineDB';

export interface SyncResponseItem {
  local_id: string;
  status: 'SYNCED' | 'CONFLICT' | 'DUPLICATE' | 'FAILED';
  server_id?: string;
  record_type?: string;
  server_data?: any;
  client_data?: any;
  error_message?: string;
  message?: string;
}

export interface BatchSyncResponse {
  total: number;
  results: SyncResponseItem[];
}

export const offlineApi = {
  /**
   * Health ping for real connection availability
   */
  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await api.get('/health', { timeout: 4000 });
      return res.status === 200 && res.data?.status === 'ok';
    } catch {
      return false;
    }
  },

  /**
   * Sync a batch of queued offline items
   */
  syncBatch: async (items: SyncQueueItem[]): Promise<BatchSyncResponse> => {
    const payloadItems = items.map((item) => ({
      local_id: item.local_id,
      record_type: item.record_type,
      endpoint: item.endpoint,
      method: item.method || 'POST',
      payload: item.payload,
      created_at: item.created_at / 1000,
      client_updated_at: item.updated_at / 1000,
    }));

    const response = await api.post<BatchSyncResponse>('/offline/sync', { items: payloadItems });
    return response.data;
  },

  /**
   * Sync a single queued item
   */
  syncSingle: async (item: SyncQueueItem): Promise<SyncResponseItem> => {
    const payload = {
      local_id: item.local_id,
      record_type: item.record_type,
      endpoint: item.endpoint,
      method: item.method || 'POST',
      payload: item.payload,
      created_at: item.created_at / 1000,
      client_updated_at: item.updated_at / 1000,
    };

    const response = await api.post<SyncResponseItem>('/offline/sync', payload);
    return response.data;
  },

  /**
   * Fetch server-side sync log history
   */
  getSyncHistory: async (limit: number = 50): Promise<{ items: any[]; count: number }> => {
    const res = await api.get('/offline/history', { params: { limit } });
    return res.data;
  },

  /**
   * Resolve a sync conflict
   */
  resolveConflict: async (localId: string, resolution: 'USE_CLIENT' | 'USE_SERVER'): Promise<any> => {
    const res = await api.post('/offline/resolve-conflict', {
      local_id: localId,
      resolution,
    });
    return res.data;
  },
};
