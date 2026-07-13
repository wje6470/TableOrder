import { useTheme } from "../hooks/useTheme";
import { secondaryButtonClass } from "../lib/ui";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className={className ?? secondaryButtonClass}>
      {theme === "dark" ? "☀️ 淺色模式" : "🌙 深色模式"}
    </button>
  );
}
