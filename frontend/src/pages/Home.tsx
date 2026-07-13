import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">點餐系統</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">開發用入口，正式環境每台平板應直接開啟對應網址</p>
      <div className="flex gap-4">
        <Link to="/order" className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
          顧客點餐平板
        </Link>
        <Link to="/store" className="rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600">
          店家後台平板
        </Link>
      </div>
    </div>
  );
}
