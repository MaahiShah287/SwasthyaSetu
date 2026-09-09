import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  getCachedSnapshot,
  setCachedSnapshot,
  enqueueSyncItem,
  OfflineRecordType,
} from '../utils/offlineDB';

const api: AxiosInstance = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 30000,
  withCredentials: true,
});

function isOfflineActive(): boolean {
  if (typeof window === 'undefined') return false;
  const simulated = localStorage.getItem('swasthyasetu_simulate_offline') === 'true';
  return !navigator.onLine || simulated;
}

function getOfflineRecordType(url: string = '', method: string = ''): OfflineRecordType | null {
  const cleanUrl = url.toLowerCase();
  if (cleanUrl.includes('/vaccinations/children') && method.toUpperCase() === 'POST') {
    return 'child_registration';
  }
  if (cleanUrl.includes('/vaccinations')) {
    return 'vaccination_record';
  }
  if (cleanUrl.includes('/follow-ups')) {
    return 'follow_up';
  }
  if (cleanUrl.includes('/profile')) {
    return 'profile_update';
  }
  if (cleanUrl.includes('/referrals')) {
    return 'referral_draft';
  }
  if (cleanUrl.includes('/diseases/report')) {
    return 'health_case_report';
  }
  return null;
}

function getCacheKey(url: string = ''): string | null {
  const cleanUrl = url.toLowerCase();
  if (cleanUrl.includes('/vaccinations/summary') || cleanUrl.includes('/vaccinations')) {
    return 'vaccinations_data';
  }
  if (cleanUrl.includes('/follow-ups')) {
    return 'followups_data';
  }
  if (cleanUrl.includes('/profile')) {
    return 'profile_data';
  }
  if (cleanUrl.includes('/referrals/history')) {
    return 'referrals_history_data';
  }
  return null;
}

// -------------------------------------------------------------
// Request Interceptor: Attach JWT & Handle Offline Interception
// -------------------------------------------------------------
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const url = config.url || '';
    const method = (config.method || 'GET').toUpperCase();

    // Bypass offline interception for the health check and sync endpoints themselves
    if (url.includes('/health') || url.includes('/offline/')) {
      return config;
    }

    if (isOfflineActive()) {
      const userEmail = localStorage.getItem('userEmail') || 'patient@swasthyasetu.org';

      // 1. Offline GET request: try to serve from IndexedDB cache
      if (method === 'GET') {
        const cacheKey = getCacheKey(url);
        if (cacheKey) {
          const cached = await getCachedSnapshot(cacheKey, userEmail);
          if (cached && cached.data) {
            // Cancel network request by throwing an adapter-like synthetic response
            const syntheticResponse: AxiosResponse = {
              data: cached.data,
              status: 200,
              statusText: 'OK (Offline Cache)',
              headers: {},
              config,
              request: {},
            };
            return Promise.reject({
              __isOfflineCache: true,
              response: syntheticResponse,
              cachedAt: cached.cached_at,
            });
          }
        }

        return Promise.reject({
          __isOfflineError: true,
          message: 'Offline: No cached data available for this view. Reconnect to fetch live data.',
        });
      }

      // 2. Offline POST/PUT/PATCH request: check if offline-supported
      const recordType = getOfflineRecordType(url, method);
      if (recordType) {
        const localId = `off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const payload = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : {};

        await enqueueSyncItem({
          local_id: localId,
          user_id: userEmail,
          record_type: recordType,
          endpoint: url,
          method: method as any,
          payload,
        });

        // Dispatch sync event to update pending badge immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('swasthyasetu:sync_completed', { detail: { queued: localId } }));
        }

        const syntheticResponse: AxiosResponse = {
          data: {
            message: 'Saved offline. Record queued for automatic synchronization.',
            status: 'QUEUED_OFFLINE',
            queued: true,
            local_id: localId,
            ...payload,
          },
          status: 200,
          statusText: 'OK (Queued Offline)',
          headers: {},
          config,
          request: {},
        };

        return Promise.reject({
          __isOfflineQueued: true,
          response: syntheticResponse,
        });
      }

      // 3. Non-offline eligible request (AI, video, file upload)
      return Promise.reject({
        __isOfflineError: true,
        message: 'This action requires an active internet connection.',
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// -------------------------------------------------------------
// Response Interceptor: Cache Online GETs & Handle Offline Synthetics
// -------------------------------------------------------------
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // When online, cache successful GET results to IndexedDB in the background
    const url = response.config.url || '';
    const method = (response.config.method || 'GET').toUpperCase();

    if (method === 'GET' && response.status === 200 && response.data) {
      const cacheKey = getCacheKey(url);
      if (cacheKey) {
        const userEmail = localStorage.getItem('userEmail') || 'patient@swasthyasetu.org';
        setCachedSnapshot(cacheKey, response.data, userEmail).catch(() => {});
      }
    }

    return response;
  },
  async (error: any) => {
    // 1. If this was a synthetic offline cache response, return it seamlessly as resolved!
    if (error && error.__isOfflineCache && error.response) {
      return error.response;
    }

    // 2. If this was a synthetic offline queued response, return it seamlessly as resolved!
    if (error && error.__isOfflineQueued && error.response) {
      return error.response;
    }

    const config = error.config as any;

    // Advanced Retry Logic for AI Services (when online)
    if (
      config &&
      (config.url?.includes('chatbot') || config.url?.includes('ai-suggestions') || config.url?.includes('claims/analyze')) &&
      !config._retry &&
      (error.code === 'ECONNABORTED' || error.response?.status === 503 || error.response?.status === 504)
    ) {
      config._retry = true;
      config.retryCount = (config.retryCount || 0) + 1;

      if (config.retryCount <= 2) {
        console.warn(`AI Node congestion detected. Retrying attempt ${config.retryCount}...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * config.retryCount));
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
