import { useState } from "react";
import { Theme, themeConfig } from "../lib/theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(themeConfig.get());

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    themeConfig.set(next);
    setTheme(next);
  }

  return { theme, toggleTheme };
}
