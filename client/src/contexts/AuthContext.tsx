import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, clearToken, type User } from "../lib/utils";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, restore the session from a stored token (persists across restarts).
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api.me();
        if (!cancelled) setUserState(user);
      } catch {
        clearToken();
        if (!cancelled) setUserState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // If any API call hits a 401, drop the session and return to the login screen.
  useEffect(() => {
    const onUnauthorized = () => setUserState(null);
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  async function login(username: string, password: string) {
    const { token, user } = await api.login({ username, password });
    setToken(token);
    setUserState(user);
  }

  async function signup(username: string, password: string, displayName?: string) {
    const { token, user } = await api.signup({ username, password, displayName });
    setToken(token);
    setUserState(user);
  }

  function logout() {
    clearToken();
    setUserState(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setUser: setUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
