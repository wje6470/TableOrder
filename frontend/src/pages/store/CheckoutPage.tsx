import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Order } from "../../types";

interface TableInfo {
  id: string;
  table_number: string;
}

export default function CheckoutPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "other">("cash");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const [openOrders, tableList] = await Promise.all([
      api.get<Order[]>("/orders/open", "store"),
      api.get<TableInfo[]>("/tables"),
    ]);
    setOrders(openOrders);
    setTables(tableList);
  }

  function tableNumberOf(tableId: string) {
    return tables.find((t) => t.id === tableId)?.table_number ?? "?";
  }

  const selectedOrder = orders.find((o) => o.id === selectedId) ?? null;

  async function confirmCheckout() {
    if (!selectedOrder) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/orders/${selectedOrder.id}/checkout`, { payment_method: paymentMethod }, "store");
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "結帳失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <h1 className="mb-4 text-lg font-bold">選擇要結帳的桌次</h1>
        <div className="space-y-2">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedId(order.id)}
              className={`w-full rounded-lg border p-3 text-left ${
                selectedId === order.id ? "border-gray-900 bg-gray-100" : "border-gray-200 bg-white"
              }`}
            >
              桌號 {tableNumberOf(order.table_id)} · NT$ {order.total_amount}
            </button>
          ))}
          {orders.length === 0 && <p className="text-gray-400">目前沒有使用中的桌次</p>}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedOrder ? (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">桌號 {tableNumberOf(selectedOrder.table_id)} 明細</h2>
            <ul className="mb-4 space-y-2 text-sm">
              {selectedOrder.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>x{item.quantity}</span>
                  <span>NT$ {item.subtotal}</span>
                </li>
              ))}
            </ul>
            <div className="mb-4 border-t pt-2 text-right text-lg font-bold">
              合計 NT$ {selectedOrder.total_amount}
            </div>

            <div className="mb-4 flex gap-3">
              {(["cash", "other"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    paymentMethod === method ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"
                  }`}
                >
                  {method === "cash" ? "現金" : "其他"}
                </button>
              ))}
            </div>

            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <button
              onClick={confirmCheckout}
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              確認結帳
            </button>
          </div>
        ) : (
          <p className="text-gray-400">請先從左側選擇桌次</p>
        )}
      </div>
    </div>
  );
}
