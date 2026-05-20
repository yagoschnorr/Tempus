import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  timezone?: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
};

const STORAGE_KEY = "tempus.auth";

const AuthContext = createContext<AuthState | null>(null);

function readStored(): { user: AuthUser | null; token: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw) as { user: AuthUser; token: string };
    return { user: parsed.user, token: parsed.token };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy init síncrono: garante que `RequireAuth` veja o token já no primeiro
  // render, evitando que F5 numa rota autenticada caia no /login.
  const [user, setUser] = useState<AuthUser | null>(() => readStored().user);
  const [token, setToken] = useState<string | null>(() => readStored().token);

  const login = useCallback((nextUser: AuthUser, nextToken: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken }));
    setUser(nextUser);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const stored = readStored();
      if (stored.token) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: next, token: stored.token }));
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, login, logout, updateUser }),
    [user, token, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
