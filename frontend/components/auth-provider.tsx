"use client";

import * as React from "react";

import {
  authApi,
  isApiError,
  type UserResponse
} from "@/lib/api";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: UserResponse | null;
  status: AuthStatus;
  error: string | null;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [user, setUser] = React.useState<UserResponse | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [error, setError] = React.useState<string | null>(null);

  const loadUser = React.useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await authApi.me();
      setUser(data);
      setStatus("authenticated");
    } catch (err) {
      setUser(null);
      if (isApiError(err) && (err.status === 401 || err.status === 403)) {
        setStatus("unauthenticated");
      } else {
        setStatus("unauthenticated");
        setError(isApiError(err) ? err.detail : "Unable to reach server");
      }
    }
  }, []);

  React.useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = React.useCallback(
    async (payload: { email: string; password: string }) => {
      setError(null);
      await authApi.login(payload);
      await loadUser();
    },
    [loadUser]
  );

  const logout = React.useCallback(async () => {
    setError(null);
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refresh = React.useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      isAuthenticated: status === "authenticated",
      login,
      logout,
      refresh
    }),
    [user, status, error, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
