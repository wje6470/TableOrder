import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { api } from "../lib/api";
import { customerAuth } from "../lib/auth";

interface CustomerAuthContextValue {
  isLoggedIn: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(!!customerAuth.getToken());

  async function login(phone: string, password: string) {
    const { access_token } = await api.post<{ access_token: string }>("/auth/customer/login", { phone, password });
    customerAuth.setToken(access_token);
    setIsLoggedIn(true);
  }

  async function register(phone: string, password: string, name?: string) {
    const { access_token } = await api.post<{ access_token: string }>("/auth/customer/register", {
      phone,
      password,
      name,
    });
    customerAuth.setToken(access_token);
    setIsLoggedIn(true);
  }

  const logout = useCallback(() => {
    customerAuth.clear();
    setIsLoggedIn(false);
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ isLoggedIn, login, register, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
