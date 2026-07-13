import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className={className}>
      {theme === "dark" ? "☀️ 淺色模式" : "🌙 深色模式"}
    </button>
  );
}
