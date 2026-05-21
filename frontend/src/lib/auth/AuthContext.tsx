import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiError } from "@/lib/api/client";
import { authApi } from "@/features/auth/api";

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

  // Sincroniza entre abas: quando outra aba faz login/logout, o `storage`
  // event dispara aqui (não na aba que originou a mudança) — refletimos a
  // mesma alteração no estado local pra não ficarmos com dados velhos.
  // Caso típico: usuário confirma troca de email no link aberto em outra aba
  // (que dispara logout), enquanto esta aba seguia logada com o email antigo.
  // Limitação: navegadores embarcados (ex: Simple Browser do VSCode) têm
  // localStorage isolado → o storage event não cruza contextos. Por isso há
  // também um refresh-on-visibility logo abaixo, que cobre esse caso.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      const stored = readStored();
      setUser(stored.user);
      setToken(stored.token);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fallback cross-context: quando a aba volta a ficar visível, refaz GET /me.
  // Se token foi revogado → logout. Se dados mudaram (ex: email alterado em
  // outra aba/navegador) → atualiza local. Sem polling: roda só no foco.
  useEffect(() => {
    if (!token) return;

    async function refresh() {
      if (document.hidden) return;
      try {
        const fresh = await authApi.me();
        setUser((prev) =>
          prev && prev.email === fresh.email && prev.name === fresh.name && prev.timezone === fresh.timezone
            ? prev
            : fresh
        );
        const stored = readStored();
        if (stored.token) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ user: fresh, token: stored.token })
          );
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404 || err.status === 403)) {
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
        // Outros erros (rede caída) — ignora, tentamos de novo no próximo foco
      }
    }

    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [token]);

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
