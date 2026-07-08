import { NavLink, Outlet } from "react-router-dom";
import { useStoreAuth } from "../../context/StoreAuthContext";

const tabs = [
  { to: "/store", label: "即時看板", end: true },
  { to: "/store/checkout", label: "結帳" },
  { to: "/store/products", label: "商品管理" },
  { to: "/store/reports", label: "報表分析" },
];

export default function StoreLayout() {
  const { logout } = useStoreAuth();

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 text-sm font-medium ${
                  isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="text-sm text-gray-500">
          登出
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
