const THEME_KEY = "theme";

export type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const themeConfig = {
  get: (): Theme => (localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"),
  set: (theme: Theme) => {
    localStorage.setItem(THEME_KEY, theme);
    apply(theme);
  },
};
