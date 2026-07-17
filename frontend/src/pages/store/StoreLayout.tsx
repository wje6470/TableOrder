import { NavLink, Outlet } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import { useStoreAuth } from "../../context/StoreAuthContext";

const tabs = [
  { to: "/store", label: "即時看板", end: true },
  { to: "/store/kitchen", label: "廚房出單" },
  { to: "/store/checkout", label: "結帳" },
  { to: "/store/coupons", label: "優惠券管理" },
  { to: "/store/products", label: "商品管理" },
  { to: "/store/reports", label: "報表分析" },
];

export default function StoreLayout() {
  const { logout } = useStoreAuth();

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <header className="flex flex-col gap-2 bg-white px-4 py-3 shadow-soft dark:bg-gray-800 dark:shadow-none dark:border-b dark:border-gray-700 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-0 md:px-8 md:py-4">
        <nav className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex-shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-3">
          <ThemeToggle className="text-sm font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            登出
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
