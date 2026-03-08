import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { API_BASE_URL, configureApiClient } from "../api/client";

interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshFnRef = useRef<() => Promise<string | null>>(async () => null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearRefreshTimer();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, [clearRefreshTimer]);

  const scheduleRefresh = useCallback(
    (token: string) => {
      clearRefreshTimer();
      const exp = parseJwtExp(token);
      if (!exp) return;

      const nowMs = Date.now();
      const expMs = exp * 1000;
      const refreshAtMs = Math.max(nowMs + 5_000, expMs - 60_000);
      const delay = Math.max(1_000, refreshAtMs - nowMs);

      refreshTimerRef.current = window.setTimeout(() => {
        void refreshFnRef.current();
      }, delay);
    },
    [clearRefreshTimer]
  );

  const applyAuth = useCallback(
    (payload: { user?: User; accessToken: string; refreshToken: string }) => {
      if (payload.user) setUser(payload.user);
      setAccessToken(payload.accessToken);
      setRefreshToken(payload.refreshToken);
      scheduleRefresh(payload.accessToken);
    },
    [scheduleRefresh]
  );

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken) return null;

    try {
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken }
      );
      applyAuth({ accessToken: response.data.accessToken, refreshToken: response.data.refreshToken });
      return response.data.accessToken;
    } catch {
      logout();
      return null;
    }
  }, [applyAuth, logout, refreshToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await axios.post<{
          user: User;
          accessToken: string;
          refreshToken: string;
        }>(`${API_BASE_URL}/api/auth/login`, { email, password });

        applyAuth({
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuth]
  );

  const register = useCallback(
    async (email: string, displayName: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await axios.post<{
          user: User;
          accessToken: string;
          refreshToken: string;
        }>(`${API_BASE_URL}/api/auth/register`, { email, displayName, password });

        applyAuth({
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuth]
  );

  useEffect(() => {
    refreshFnRef.current = refreshAccessToken;
  }, [refreshAccessToken]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessToken,
      refreshAccessToken,
      clearAuth: logout,
    });
  }, [accessToken, refreshAccessToken, logout]);

  useEffect(() => {
    return () => {
      clearRefreshTimer();
    };
  }, [clearRefreshTimer]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isLoading,
      login,
      register,
      logout,
      refreshAccessToken,
    }),
    [user, accessToken, isLoading, login, register, logout, refreshAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
