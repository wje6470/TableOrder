import { Link } from "react-router-dom";
import { mutedTextClass, primaryButtonClass } from "../lib/ui";

export default function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-6 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">點餐系統</h1>
        <p className={`mt-2 text-sm ${mutedTextClass}`}>開發用入口，正式環境每台平板應直接開啟對應網址</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link to="/order" className={primaryButtonClass}>
          顧客點餐平板
        </Link>
        <Link
          to="/store"
          className="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-700 shadow-soft transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          店家後台平板
        </Link>
      </div>
    </div>
  );
}
