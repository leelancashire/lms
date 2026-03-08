import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type AuthAdapter = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  clearAuth: () => void;
};

let authAdapter: AuthAdapter | null = null;

export function configureApiClient(adapter: AuthAdapter) {
  authAdapter = adapter;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

apiClient.interceptors.request.use((config) => {
  const token = authAdapter?.getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? "";

    if (!config || status !== 401 || config._retry) {
      return Promise.reject(error);
    }

    if (url.includes("/api/auth/login") || url.includes("/api/auth/register") || url.includes("/api/auth/refresh")) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      const newAccessToken = await authAdapter?.refreshAccessToken();
      if (!newAccessToken) {
        authAdapter?.clearAuth();
        return Promise.reject(error);
      }

      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      authAdapter?.clearAuth();
      return Promise.reject(refreshError);
    }
  }
);

export { API_BASE_URL };
