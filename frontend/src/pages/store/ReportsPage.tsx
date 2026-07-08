import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { storeAuth } from "../../lib/auth";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500">開始日期</label>
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">結束日期</label>
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["csv", "xlsx", "pdf"] as const).map((format) => (
            <button
              key={format}
              onClick={() => exportReport(format)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              匯出 {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">總營收</p>
          <p className="text-2xl font-bold">NT$ {avgOrderValue?.total_revenue ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">訂單數</p>
          <p className="text-2xl font-bold">{avgOrderValue?.order_count ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">客單價</p>
          <p className="text-2xl font-bold">NT$ {avgOrderValue?.avg_order_value ?? 0}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">每日營收</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">商品銷售排行</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">商品</th>
              <th className="py-2">銷售數量</th>
              <th className="py-2">營收</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.product_id} className="border-b last:border-0">
                <td className="py-2">{p.product_name}</td>
                <td className="py-2">{p.quantity_sold}</td>
                <td className="py-2">NT$ {p.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {topProducts.length === 0 && <p className="py-4 text-center text-gray-400">此區間尚無銷售資料</p>}
      </div>
    </div>
  );
}
