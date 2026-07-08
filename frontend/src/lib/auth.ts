const CUSTOMER_TOKEN_KEY = "customer_token";
const STORE_TOKEN_KEY = "store_token";

export const customerAuth = {
  getToken: () => localStorage.getItem(CUSTOMER_TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(CUSTOMER_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(CUSTOMER_TOKEN_KEY),
};

export const storeAuth = {
  getToken: () => localStorage.getItem(STORE_TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(STORE_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(STORE_TOKEN_KEY),
};
