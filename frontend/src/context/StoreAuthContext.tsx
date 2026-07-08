import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "../lib/api";
import { storeAuth } from "../lib/auth";

interface StoreAuthContextValue {
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const StoreAuthContext = createContext<StoreAuthContextValue | undefined>(undefined);

export function StoreAuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(!!storeAuth.getToken());

  async function login(username: string, password: string) {
    const { access_token } = await api.post<{ access_token: string }>("/auth/store/login", { username, password });
    storeAuth.setToken(access_token);
    setIsLoggedIn(true);
  }

  function logout() {
    storeAuth.clear();
    setIsLoggedIn(false);
  }

  return <StoreAuthContext.Provider value={{ isLoggedIn, login, logout }}>{children}</StoreAuthContext.Provider>;
}

export function useStoreAuth() {
  const ctx = useContext(StoreAuthContext);
  if (!ctx) throw new Error("useStoreAuth must be used within StoreAuthProvider");
  return ctx;
}
