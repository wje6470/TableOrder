import { StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import LinePayScanModal from "../../components/store/LinePayScanModal";
import { api, ApiError } from "../../lib/api";
import { previewDiscount } from "../../lib/coupon";
import { supabase } from "../../lib/supabaseClient";
import { cardClass, inputClass, mutedTextClass, primaryButtonClass } from "../../lib/ui";
import { Coupon, Order } from "../../types";

interface TableInfo {
  id: string;
  table_number: string;
}

export default function CheckoutPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "linepay" | "paypal">("cash");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");

  useEffect(() => {
    void refresh();

    // 結帳可能從別的裝置／分頁完成（例如另一台平板也開著結帳頁），這頁自己沒有主動送出
    // 結帳動作就不會知道，訂單會一直留在畫面上，所以要訂閱 Realtime 才能自動同步。
    const channel = supabase
      .channel("store-checkout")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function refresh() {
    const [openOrders, tableList, couponList] = await Promise.all([
      api.get<Order[]>("/orders/open", "store"),
      api.get<TableInfo[]>("/tables"),
      api.get<Coupon[]>("/coupons", "store"),
    ]);
    setOrders(openOrders);
    setTables(tableList);
    setCoupons(couponList);
  }

  function tableNumberOf(tableId: string) {
    return tables.find((t) => t.id === tableId)?.table_number ?? "?";
  }

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;
  // 剛開桌但還沒點餐（金額 0）的訂單不需要先顯示在結帳清單裡
  const visibleOrders = orders.filter((order) => Number(order.total_amount) > 0);
  const appliedCoupon = coupons.find((c) => c.order_id === selectedOrder?.id && !c.is_used) ?? null;
  const preview = selectedOrder && appliedCoupon ? previewDiscount(selectedOrder, appliedCoupon) : null;
  const discount = preview?.discount ?? 0;
  const amountDue = selectedOrder ? Number(selectedOrder.total_amount) - discount : 0;
  const receivedNumber = Number(receivedAmount);
  const change = receivedNumber - amountDue;

  function selectOrder(id: string) {
    setSelectedId(id);
    setPaymentMethod("cash");
    setError(null);
    setShowScanner(false);
    setReceivedAmount("");
  }

  async function confirmDirectCheckout(method: "cash" | "paypal") {
    if (!selectedOrder) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/orders/${selectedOrder.id}/checkout`, { payment_method: method }, "store");
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "結帳失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScanDetected(oneTimeKey: string) {
    if (!selectedOrder) return;
    setShowScanner(false);
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/orders/${selectedOrder.id}/payments/linepay/scan`, { one_time_key: oneTimeKey }, "store");
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "LINE Pay 付款失敗，請確認顧客付款碼後重新掃描");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-3">
      <div className="md:col-span-1">
        <h1 className="mb-4 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">選擇要結帳的桌次</h1>
        <div className="space-y-2">
          {visibleOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => selectOrder(order.id)}
              className={`w-full rounded-xl p-4 text-left text-gray-900 transition dark:text-gray-100 ${
                selectedId === order.id
                  ? "bg-orange-500 text-white shadow-soft"
                  : `${cardClass} hover:-translate-y-0.5 hover:shadow-soft-md`
              }`}
            >
              桌號 {tableNumberOf(order.table_id)} · NT$ {order.total_amount}
            </button>
          ))}
          {visibleOrders.length === 0 && <p className={mutedTextClass}>目前沒有使用中的桌次</p>}
        </div>
      </div>

      <div className="md:col-span-2">
        {selectedOrder ? (
          <div className={`${cardClass} p-6`}>
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              桌號 {tableNumberOf(selectedOrder.table_id)} 明細
            </h2>
            <ul className="mb-4 space-y-2 text-sm text-gray-800 dark:text-gray-200">
              {selectedOrder.items.map((item) => (
                <li key={item.id}>
                  <div className="flex justify-between">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>NT$ {item.subtotal}</span>
                  </div>
                  {item.options.length > 0 && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {item.options.map((o) => o.option_name).join("、")}
                    </div>
                  )}
                  {item.note && (
                    <div className="mt-0.5 flex items-start gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                      <StickyNote className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>{item.note}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mb-5 border-t border-gray-100 pt-3 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>小計</span>
                <span>NT$ {selectedOrder.total_amount}</span>
              </div>
              {appliedCoupon && preview?.applicable && (
                <div className="mt-1 flex items-center justify-between text-sm text-orange-600 dark:text-orange-400">
                  <span>優惠券：{appliedCoupon.title ?? "折扣"}</span>
                  <span>-NT$ {discount}</span>
                </div>
              )}
              {appliedCoupon && preview && !preview.applicable && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  已套用的優惠券{appliedCoupon.product_id ? "（顧客未點限定商品）" : "（已過期）"}不適用，結帳時不會折抵
                </p>
              )}
              <div className="mt-1 flex items-center justify-between text-lg font-bold text-gray-900 dark:text-gray-100">
                <span>應付</span>
                <span>NT$ {(Number(selectedOrder.total_amount) - discount).toFixed(2)}</span>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-3">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  paymentMethod === "cash"
                    ? "bg-orange-500 text-white"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                }`}
              >
                現金
              </button>
              <button
                onClick={() => setPaymentMethod("linepay")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  paymentMethod === "linepay"
                    ? "bg-orange-500 text-white"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                }`}
              >
                LINE Pay
              </button>
              <button
                onClick={() => setPaymentMethod("paypal")}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  paymentMethod === "paypal"
                    ? "bg-orange-500 text-white"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                }`}
              >
                PayPal（刷卡機）
              </button>
            </div>

            {paymentMethod === "cash" && (
              <div className={`${cardClass} mb-5 p-4`}>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  收現金額（找零計算機）
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="輸入顧客付的金額"
                  className={inputClass}
                />
                {receivedAmount !== "" && (
                  <div
                    className={`mt-3 flex items-center justify-between text-lg font-bold ${
                      change < 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    <span>{change < 0 ? "還差" : "應找零"}</span>
                    <span>NT$ {Math.abs(change).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "paypal" && (
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                請將無線刷卡機交給顧客感應／插卡，刷卡機上完成付款後再按下方確認
              </p>
            )}

            {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            {submitting && paymentMethod === "linepay" ? (
              <p className="mb-3 text-sm text-orange-600 dark:text-orange-400">LINE Pay 付款處理中，請稍候…</p>
            ) : null}

            <button
              onClick={
                paymentMethod === "linepay" ? () => setShowScanner(true) : () => confirmDirectCheckout(paymentMethod)
              }
              disabled={submitting}
              className={primaryButtonClass}
            >
              {paymentMethod === "cash" ? "確認結帳" : paymentMethod === "paypal" ? "確認已刷卡收款" : "掃描顧客付款碼"}
            </button>
          </div>
        ) : (
          <p className={mutedTextClass}>請先從左側選擇桌次</p>
        )}
      </div>

      {showScanner && (
        <LinePayScanModal onDetected={handleScanDetected} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
