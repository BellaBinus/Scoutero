import { useCallback, useContext, createContext } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);

  const login = useCallback(() => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/api/logout";
  }, []);

  if (ctx) return ctx;

  // Fallback: should not normally be reached when AuthProvider wraps the app.
  // Return a stable object with no user so callers still type-check.
  return { user: null, isLoading: true, isAuthenticated: false, login, logout };
}
