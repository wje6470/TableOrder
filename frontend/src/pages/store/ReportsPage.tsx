import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../hooks/useTheme";
import { storeAuth } from "../../lib/auth";
import { cardClass, mutedTextClass, secondaryButtonClass } from "../../lib/ui";

interface RevenuePoint {
  period: string;
  revenue: string;
  order_count: number;
}

interface ProductRanking {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: string;
}

interface AvgOrderValue {
  order_count: number;
  total_revenue: string;
  avg_order_value: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<ProductRanking[]>([]);
  const [avgOrderValue, setAvgOrderValue] = useState<AvgOrderValue | null>(null);

  useEffect(() => {
    void loadReports();
  }, [startDate, endDate]);

  async function authedGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${storeAuth.getToken()}` },
    });
    return res.json();
  }

  async function loadReports() {
    const query = `start_date=${startDate}&end_date=${endDate}`;
    const [rev, top, avg] = await Promise.all([
      authedGet<RevenuePoint[]>(`/reports/revenue?${query}&period=daily`),
      authedGet<ProductRanking[]>(`/reports/top-products?${query}&limit=10`),
      authedGet<AvgOrderValue>(`/reports/avg-order-value?${query}`),
    ]);
    setRevenue(rev);
    setTopProducts(top);
    setAvgOrderValue(avg);
  }

  async function exportReport(format: "csv" | "xlsx" | "pdf") {
    const res = await fetch(
      `${API_BASE_URL}/reports/export?start_date=${startDate}&end_date=${endDate}&format=${format}`,
      { headers: { Authorization: `Bearer ${storeAuth.getToken()}` } }
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${startDate}_${endDate}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = revenue.map((r) => ({ period: r.period, revenue: Number(r.revenue) }));

  const dateInputClass =
    "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={`mb-1.5 block text-xs font-medium ${mutedTextClass}`}>開始日期</label>
          <input type="date" className={dateInputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={`mb-1.5 block text-xs font-medium ${mutedTextClass}`}>結束日期</label>
          <input type="date" className={dateInputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {(["csv", "xlsx", "pdf"] as const).map((format) => (
            <button key={format} onClick={() => exportReport(format)} className={secondaryButtonClass}>
              匯出 {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className={`${cardClass} p-5`}>
          <p className={`text-xs ${mutedTextClass}`}>總營收</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            NT$ {avgOrderValue?.total_revenue ?? 0}
          </p>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className={`text-xs ${mutedTextClass}`}>訂單數</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {avgOrderValue?.order_count ?? 0}
          </p>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className={`text-xs ${mutedTextClass}`}>客單價</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            NT$ {avgOrderValue?.avg_order_value ?? 0}
          </p>
        </div>
      </div>

      <div className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold tracking-tight text-gray-900 dark:text-gray-100">每日營收</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
              <XAxis dataKey="period" fontSize={12} stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <YAxis fontSize={12} stroke={isDark ? "#9ca3af" : "#6b7280"} />
              <Tooltip
                contentStyle={
                  isDark
                    ? { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", color: "#f3f4f6" }
                    : { borderRadius: "0.75rem", border: "1px solid #e5e7eb" }
                }
              />
              <Bar dataKey="revenue" fill={isDark ? "#fb923c" : "#f97316"} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold tracking-tight text-gray-900 dark:text-gray-100">商品銷售排行</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm text-gray-800 dark:text-gray-200">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-2 font-medium">商品</th>
                <th className="py-2 font-medium">銷售數量</th>
                <th className="py-2 font-medium">營收</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.product_id} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                  <td className="py-2.5">{p.product_name}</td>
                  <td className="py-2.5">{p.quantity_sold}</td>
                  <td className="py-2.5">NT$ {p.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topProducts.length === 0 && (
          <p className="py-4 text-center text-gray-400 dark:text-gray-500">此區間尚無銷售資料</p>
        )}
      </div>
    </div>
  );
}
