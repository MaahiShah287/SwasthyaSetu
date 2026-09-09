import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  enqueueSyncItem,
  getAllQueueItems,
  getMeta,
  setMeta,
  SyncQueueItem,
  OfflineRecordType,
} from '../utils/offlineDB';
import { syncManager, SyncExecutionResult } from '../services/syncManager';
import { offlineApi } from '../api/offlineApi';

export interface OfflineContextType {
  isOnline: boolean;
  effectiveOnline: boolean; // false if offline or simulated offline
  isSimulatedOffline: boolean;
  setSimulatedOffline: (sim: boolean) => void;
  toggleSimulatedOffline: () => void;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  syncedCount: number;
  failedCount: number;
  lastSynced: number | null;
  syncNow: () => Promise<SyncExecutionResult>;
  queueRecord: (
    recordType: OfflineRecordType,
    payload: any,
    endpoint?: string,
    method?: 'POST' | 'PUT' | 'PATCH'
  ) => Promise<SyncQueueItem>;
  retryRecord: (localId: string) => Promise<any>;
  resolveConflict: (localId: string, resolution: 'USE_CLIENT' | 'USE_SERVER') => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => {
    return localStorage.getItem('swasthyasetu_simulate_offline') === 'true';
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [syncedCount, setSyncedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  const effectiveOnline = isOnline && !isSimulatedOffline;

  // Function to calculate counts
  const refreshCounts = useCallback(async () => {
    try {
      const items = await getAllQueueItems();
      let pending = 0;
      let conflicts = 0;
      let synced = 0;
      let failed = 0;

      for (const itm of items) {
        if (itm.sync_status === 'PENDING') pending++;
        else if (itm.sync_status === 'SYNCING') pending++;
        else if (itm.sync_status === 'FAILED') failed++;
        else if (itm.sync_status === 'CONFLICT') conflicts++;
        else if (itm.sync_status === 'SYNCED') synced++;
      }

      setPendingCount(pending);
      setConflictCount(conflicts);
      setSyncedCount(synced);
      setFailedCount(failed);

      const last = await getMeta<number>('last_synced_at');
      if (last) setLastSynced(last);
    } catch (err) {
      console.warn('[OfflineContext] Failed to count queue items:', err);
    }
  }, []);

  // Sync action
  const syncNow = useCallback(async (): Promise<SyncExecutionResult> => {
    if (!effectiveOnline) {
      console.log('[OfflineContext] Cannot sync: currently offline or simulated offline');
      return { synced: 0, conflicts: 0, failed: 0, total: 0, details: [] };
    }

    setIsSyncing(true);
    try {
      const res = await syncManager.syncAll();
      await refreshCounts();
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [effectiveOnline, refreshCounts]);

  // Network event listeners
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[OfflineContext] Browser signaled ONLINE');
      setIsOnline(true);
      // Verify real connectivity with a health ping
      const healthy = await offlineApi.checkHealth();
      if (healthy) {
        setIsOnline(true);
        if (!isSimulatedOffline) {
          console.log('[OfflineContext] Network restored, auto-triggering sync...');
          syncNow();
        }
      }
    };

    const handleOffline = () => {
      console.log('[OfflineContext] Browser signaled OFFLINE');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count load
    refreshCounts();

    // Periodic heartbeat every 20s to check actual connectivity
    const interval = setInterval(async () => {
      if (navigator.onLine && !isSimulatedOffline) {
        const healthy = await offlineApi.checkHealth();
        setIsOnline(healthy);
        // If there are pending items and we are online and not syncing, trigger auto-sync
        if (healthy && pendingCount > 0 && !isSyncing) {
          syncNow();
        }
      } else if (!navigator.onLine) {
        setIsOnline(false);
      }
    }, 20000);

    // Listen for custom sync events
    const handleSyncComplete = () => {
      refreshCounts();
    };
    window.addEventListener('swasthyasetu:sync_completed', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('swasthyasetu:sync_completed', handleSyncComplete);
      clearInterval(interval);
    };
  }, [isSimulatedOffline, pendingCount, isSyncing, syncNow, refreshCounts]);

  // Toggle simulated offline for field worker testing
  const toggleSimulatedOffline = useCallback(() => {
    setIsSimulatedOffline((prev) => {
      const next = !prev;
      localStorage.setItem('swasthyasetu_simulate_offline', String(next));
      if (!next && isOnline) {
        // Auto-sync when toggled back online
        setTimeout(() => syncNow(), 500);
      }
      return next;
    });
  }, [isOnline, syncNow]);

  const setSimulatedOffline = useCallback(
    (sim: boolean) => {
      setIsSimulatedOffline(sim);
      localStorage.setItem('swasthyasetu_simulate_offline', String(sim));
      if (!sim && isOnline) {
        setTimeout(() => syncNow(), 500);
      }
    },
    [isOnline, syncNow]
  );

  // Helper to directly queue a record
  const queueRecord = useCallback(
    async (
      recordType: OfflineRecordType,
      payload: any,
      endpoint?: string,
      method: 'POST' | 'PUT' | 'PATCH' = 'POST'
    ): Promise<SyncQueueItem> => {
      const userEmail = localStorage.getItem('userEmail') || 'patient@swasthyasetu.org';
      const localId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const item = await enqueueSyncItem({
        local_id: localId,
        user_id: userEmail,
        record_type: recordType,
        endpoint,
        method,
        payload,
      });

      await refreshCounts();

      // If we are currently online, try to auto-sync immediately!
      if (effectiveOnline) {
        syncNow();
      }

      return item;
    },
    [effectiveOnline, refreshCounts, syncNow]
  );

  const retryRecord = useCallback(
    async (localId: string) => {
      setIsSyncing(true);
      try {
        const res = await syncManager.retryItem(localId);
        await refreshCounts();
        return res;
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshCounts]
  );

  const resolveConflict = useCallback(
    async (localId: string, resolution: 'USE_CLIENT' | 'USE_SERVER') => {
      setIsSyncing(true);
      try {
        await syncManager.resolveConflict(localId, resolution);
        await refreshCounts();
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshCounts]
  );

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        effectiveOnline,
        isSimulatedOffline,
        setSimulatedOffline,
        toggleSimulatedOffline,
        isSyncing,
        pendingCount,
        conflictCount,
        syncedCount,
        failedCount,
        lastSynced,
        syncNow,
        queueRecord,
        retryRecord,
        resolveConflict,
        refreshCounts,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextType => {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return ctx;
};
