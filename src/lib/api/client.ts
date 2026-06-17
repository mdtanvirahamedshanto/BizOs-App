import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

// Backend Base URL.
// Override per-environment via `EXPO_PUBLIC_API_URL` (e.g. in .env / eas.json).
// Default targets the Android emulator's host loopback (10.0.2.2). For a
// physical device use your machine's LAN IP, e.g. http://192.168.0.10:5000/api/v1
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://10.0.2.2:4000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Build a request config carrying a stable idempotency key.
 *
 * The SAME key must be used for the initial online attempt AND every outbox
 * retry of the same logical operation (use the client-generated entity id).
 * This lets the backend dedupe a request that succeeded server-side but whose
 * response was lost — preventing duplicate sales / cash entries / stock moves.
 */
export function idempotent(key: string) {
  return { headers: { 'X-Idempotency-Key': key } };
}

// Queue variables for handling token refresh requests concurrently
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: Attach bearer token dynamically from MMKV
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = kvStorage.getItem(storageKeys.AUTH_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Manage 401 token refresh pipeline
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Lock request to avoid infinite loops
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(apiClient(originalRequest));
          },
          reject: (err: any) => {
            reject(err);
          },
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = kvStorage.getItem(storageKeys.REFRESH_TOKEN);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Execute refresh request against backend
      const response = await axios.post<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
        `${BASE_URL}/auth/refresh`,
        { refreshToken }
      );

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

      // Save new tokens to MMKV
      kvStorage.setItem(storageKeys.AUTH_TOKEN, newAccessToken);
      kvStorage.setItem(storageKeys.REFRESH_TOKEN, newRefreshToken);

      // Replay all queued requests
      processQueue(null, newAccessToken);
      isRefreshing = false;

      // Replay original request
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;

      // Refresh session expired: clear credentials AND reset in-memory auth
      // state so the UI immediately returns to the login screen instead of
      // leaving the user stranded with dead tokens until the next restart.
      // Lazy require avoids a circular import (auth store -> api -> auth store).
      try {
        const { useAuthStore } = require('@/store/auth.store') as typeof import('@/store/auth.store');
        useAuthStore.getState().logout();
      } catch {
        kvStorage.removeItem(storageKeys.AUTH_TOKEN);
        kvStorage.removeItem(storageKeys.REFRESH_TOKEN);
        kvStorage.removeItem(storageKeys.USER_SESSION);
        kvStorage.removeItem(storageKeys.USER_PERMISSIONS);
      }

      return Promise.reject(refreshError);
    }
  }
);

// 3. Configure global TanStack Query Client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes standard query freshness cache
      refetchOnWindowFocus: false,
    },
  },
});
