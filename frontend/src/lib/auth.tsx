"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AUTH_EXPIRED_EVENT, tokenStorage } from "./api";
import { authApi } from "./endpoints";
import type { User } from "./types";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; departmentId: number }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

    useEffect(() => {
    let cancelled = false;
    const onExpired = () => {
      setUser(null);
      setStatus("anonymous");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    // One async path for both cases: no token simply means no user
    const session: Promise<User | null> = tokenStorage.get()
      ? authApi.me().then((r) => r.user).catch(() => null)
      : Promise.resolve(null);

    session.then((me) => {
      if (cancelled) return;
      setUser(me);
      setStatus(me ? "authenticated" : "anonymous");
    });

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    tokenStorage.set(res.token);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string; departmentId: number }) => {
    const res = await authApi.register(input);
    tokenStorage.set(res.token);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus("anonymous");
    router.push("/login");
  }, [router]);

  const value = useMemo(() => ({ user, status, login, register, logout }), [user, status, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}