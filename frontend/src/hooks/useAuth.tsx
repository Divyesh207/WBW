import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SESSION_ENDED, authToken } from "../services/api";
import { authApi, type RegisterInput } from "../services/marketApi";
import type { User } from "../types/market";

interface AuthState {
  user: User | null;
  /** True until the stored token has been checked on first load. */
  checking: boolean;
  /** True after the server ended the session (expired or unknown token) until the next sign-in. */
  sessionEnded: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Marketplace accounts. Assessment tools stay usable without signing in. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => !!authToken.get());
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    const onEnded = () => {
      setUser((current) => {
        if (current) setSessionEnded(true);
        return null;
      });
    };
    window.addEventListener(SESSION_ENDED, onEnded);
    return () => window.removeEventListener(SESSION_ENDED, onEnded);
  }, []);

  useEffect(() => {
    if (!authToken.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => authToken.clear()) // expired or revoked token
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    authToken.set(res.token);
    setUser(res.user);
    setSessionEnded(false);
    return res.user;
  }, []);

  const register = useCallback(async (body: RegisterInput) => {
    const res = await authApi.register(body);
    authToken.set(res.token);
    setUser(res.user);
    setSessionEnded(false);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      authToken.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, checking, sessionEnded, login, register, logout }), [user, checking, sessionEnded, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const homeFor = (user: User) => (user.role === "supplier" ? "/app/supplier" : "/app/market");
