const TABLE_NUMBER_KEY = "table_number";

export const tableConfig = {
  get: () => localStorage.getItem(TABLE_NUMBER_KEY),
  set: (tableNumber: string) => localStorage.setItem(TABLE_NUMBER_KEY, tableNumber),
  clear: () => localStorage.removeItem(TABLE_NUMBER_KEY),
};
