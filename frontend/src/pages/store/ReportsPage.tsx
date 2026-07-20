import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

interface PaymentMethodBreakdown {
  payment_method: string;
  revenue: string;
  order_count: number;
}

interface CategoryRanking {
  category_id: string | null;
  category_name: string;
  quantity_sold: number;
  revenue: string;
}

interface ProductRevenuePoint {
  period: string;
  quantity_sold: number;
  revenue: string;
}

interface CouponSourceStats {
  source: string;
  issued_count: number;
  used_count: number;
}

interface CouponStats {
  by_source: CouponSourceStats[];
  total_discount_amount: string;
}

interface ProductOption {
  id: string;
  name: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  linepay: "LINE Pay",
  paypal: "PayPal",
  unknown: "未知",
};

const COUPON_SOURCE_LABELS: Record<string, string> = {
  birthday: "生日禮",
  general: "一般優惠",
  manual: "手動發放",
  bulk: "批次發放",
};

const PAYMENT_METHOD_VALUES = ["cash", "linepay", "paypal"];

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
  const barColor = isDark ? "#fb923c" : "#f97316";
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<ProductRanking[]>([]);
  const [topProductsSortBy, setTopProductsSortBy] = useState<"quantity" | "revenue">("quantity");
  const [avgOrderValue, setAvgOrderValue] = useState<AvgOrderValue | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodBreakdown[]>([]);
  const [categoryRanking, setCategoryRanking] = useState<CategoryRanking[]>([]);
  const [couponStats, setCouponStats] = useState<CouponStats | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productTrend, setProductTrend] = useState<ProductRevenuePoint[]>([]);
  // 匯出篩選：空陣列＝不篩選（等於全選），不影響上面報表區塊看的資料
  const [exportProductIds, setExportProductIds] = useState<string[]>([]);
  const [exportPaymentMethods, setExportPaymentMethods] = useState<string[]>([]);
  const [showExportFilters, setShowExportFilters] = useState(false);

  useEffect(() => {
    void loadReports();
  }, [startDate, endDate, topProductsSortBy]);

  useEffect(() => {
    void loadProductOptions();
  }, []);

  useEffect(() => {
    void loadProductTrend();
  }, [selectedProductId, startDate, endDate]);

  async function authedGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${storeAuth.getToken()}` },
    });
    return res.json();
  }

  async function loadReports() {
    const query = `start_date=${startDate}&end_date=${endDate}`;
    const [rev, top, avg, payment, category, coupons] = await Promise.all([
      authedGet<RevenuePoint[]>(`/reports/revenue?${query}&period=daily`),
      authedGet<ProductRanking[]>(`/reports/top-products?${query}&limit=10&sort_by=${topProductsSortBy}`),
      authedGet<AvgOrderValue>(`/reports/avg-order-value?${query}`),
      authedGet<PaymentMethodBreakdown[]>(`/reports/payment-methods?${query}`),
      authedGet<CategoryRanking[]>(`/reports/categories?${query}`),
      authedGet<CouponStats>(`/reports/coupons?${query}`),
    ]);
    setRevenue(rev);
    setTopProducts(top);
    setAvgOrderValue(avg);
    setPaymentMethods(payment);
    setCategoryRanking(category);
    setCouponStats(coupons);
  }

  async function loadProductOptions() {
    const res = await fetch(`${API_BASE_URL}/products`);
    const list = (await res.json()) as ProductOption[];
    setProducts(list);
  }

  async function loadProductTrend() {
    if (!selectedProductId) {
      setProductTrend([]);
      return;
    }
    const query = `start_date=${startDate}&end_date=${endDate}&period=daily`;
    const trend = await authedGet<ProductRevenuePoint[]>(`/reports/products/${selectedProductId}/revenue?${query}`);
    setProductTrend(trend);
  }

  function toggleInList(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function exportReport(format: "csv" | "xlsx" | "pdf") {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, format });
    exportProductIds.forEach((id) => params.append("product_ids", id));
    exportPaymentMethods.forEach((method) => params.append("payment_methods", method));
    const res = await fetch(`${API_BASE_URL}/reports/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${storeAuth.getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${startDate}_${endDate}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = revenue.map((r) => ({ period: r.period, revenue: Number(r.revenue) }));
  const paymentChartData = paymentMethods.map((p) => ({
    method: PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method,
    revenue: Number(p.revenue),
    order_count: p.order_count,
  }));
  const productTrendData = productTrend.map((p) => ({ period: p.period, revenue: Number(p.revenue) }));
  const selectedProductName = useMemo(
    () => products.find((p) => p.id === selectedProductId)?.name ?? "",
    [products, selectedProductId]
  );

  const dateInputClass =
    "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

  const tooltipStyle = isDark
    ? { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "0.75rem", color: "#f3f4f6" }
    : { borderRadius: "0.75rem", border: "1px solid #e5e7eb" };

  return (
    <div className="space-y-6">
      <div className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={`mb-1.5 block text-xs font-medium ${mutedTextClass}`}>開始日期</label>
            <input type="date" className={dateInputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={`mb-1.5 block text-xs font-medium ${mutedTextClass}`}>結束日期</label>
            <input type="date" className={dateInputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowExportFilters((v) => !v)}
              className={`flex items-center gap-1.5 ${secondaryButtonClass}`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              匯出篩選
              {(exportProductIds.length > 0 || exportPaymentMethods.length > 0) && (
                <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {exportProductIds.length + exportPaymentMethods.length}
                </span>
              )}
              {showExportFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {(["csv", "xlsx", "pdf"] as const).map((format) => (
              <button key={format} onClick={() => exportReport(format)} className={secondaryButtonClass}>
                匯出 {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {showExportFilters && (
          <div className="mt-5 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <p className={`text-xs ${mutedTextClass}`}>（預設為全選）</p>
            <div>
              <p className={`mb-2 text-xs font-medium ${mutedTextClass}`}>商品</p>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setExportProductIds((prev) => toggleInList(prev, p.id))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      exportProductIds.includes(p.id)
                        ? "bg-orange-500 text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`mb-2 text-xs font-medium ${mutedTextClass}`}>付款方式</p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHOD_VALUES.map((method) => (
                  <button
                    key={method}
                    onClick={() => setExportPaymentMethods((prev) => toggleInList(prev, method))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      exportPaymentMethods.includes(method)
                        ? "bg-orange-500 text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill={barColor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold tracking-tight text-gray-900 dark:text-gray-100">付款方式分布</h2>
        {paymentChartData.length > 0 ? (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={paymentChartData} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                <XAxis type="number" fontSize={12} stroke={isDark ? "#9ca3af" : "#6b7280"} />
                <YAxis type="category" dataKey="method" fontSize={12} width={80} stroke={isDark ? "#9ca3af" : "#6b7280"} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, _name, item) => [
                    `NT$ ${value}（${item.payload.order_count} 筆）`,
                    "營收",
                  ]}
                />
                <Bar dataKey="revenue" fill={barColor} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={`py-4 text-center ${mutedTextClass}`}>此區間尚無銷售資料</p>
        )}
      </div>

      <div className={`${cardClass} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold tracking-tight text-gray-900 dark:text-gray-100">商品銷售排行</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setTopProductsSortBy("quantity")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                topProductsSortBy === "quantity"
                  ? "bg-orange-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
              }`}
            >
              依銷售數量
            </button>
            <button
              onClick={() => setTopProductsSortBy("revenue")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                topProductsSortBy === "revenue"
                  ? "bg-orange-500 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
              }`}
            >
              依營收
            </button>
          </div>
        </div>
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

      <div className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold tracking-tight text-gray-900 dark:text-gray-100">單一商品營收趨勢</h2>
        <div className="mb-4">
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className={dateInputClass}
          >
            <option value="">選擇商品…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {selectedProductId ? (
          productTrendData.length > 0 ? (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={productTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                  <XAxis dataKey="period" fontSize={12} stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <YAxis fontSize={12} stroke={isDark ? "#9ca3af" : "#6b7280"} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`NT$ ${value}`, selectedProductName]} />
                  <Bar dataKey="revenue" fill={barColor} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={`py-4 text-center ${mutedTextClass}`}>此區間「{selectedProductName}」尚無銷售資料</p>
          )
        ) : (
          <p className={`py-4 text-center ${mutedTextClass}`}>請先選擇一個商品</p>
        )}
      </div>

      <div className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold tracking-tight text-gray-900 dark:text-gray-100">分類銷售統計</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm text-gray-800 dark:text-gray-200">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-2 font-medium">分類</th>
                <th className="py-2 font-medium">銷售數量</th>
                <th className="py-2 font-medium">營收</th>
              </tr>
            </thead>
            <tbody>
              {categoryRanking.map((c) => (
                <tr key={c.category_id ?? "uncategorized"} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                  <td className="py-2.5">{c.category_name}</td>
                  <td className="py-2.5">{c.quantity_sold}</td>
                  <td className="py-2.5">NT$ {c.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {categoryRanking.length === 0 && (
          <p className="py-4 text-center text-gray-400 dark:text-gray-500">此區間尚無銷售資料</p>
        )}
      </div>

      <div className={`${cardClass} p-5`}>
        <h2 className="mb-4 font-semibold tracking-tight text-gray-900 dark:text-gray-100">優惠券成效</h2>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className={`text-xs ${mutedTextClass}`}>發放張數</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {couponStats?.by_source.reduce((sum, s) => sum + s.issued_count, 0) ?? 0}
            </p>
          </div>
          <div>
            <p className={`text-xs ${mutedTextClass}`}>使用張數</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {couponStats?.by_source.reduce((sum, s) => sum + s.used_count, 0) ?? 0}
            </p>
          </div>
          <div>
            <p className={`text-xs ${mutedTextClass}`}>折抵總金額</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              NT$ {couponStats?.total_discount_amount ?? 0}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm text-gray-800 dark:text-gray-200">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-2 font-medium">類型</th>
                <th className="py-2 font-medium">發放張數</th>
                <th className="py-2 font-medium">使用張數</th>
              </tr>
            </thead>
            <tbody>
              {couponStats?.by_source.map((s) => (
                <tr key={s.source} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                  <td className="py-2.5">{COUPON_SOURCE_LABELS[s.source] ?? s.source}</td>
                  <td className="py-2.5">{s.issued_count}</td>
                  <td className="py-2.5">{s.used_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(couponStats?.by_source.length ?? 0) === 0 && (
          <p className="py-4 text-center text-gray-400 dark:text-gray-500">此區間沒有優惠券發放紀錄</p>
        )}
      </div>
    </div>
  );
}
