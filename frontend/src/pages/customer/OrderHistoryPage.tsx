import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Order } from "../../types";

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void api.get<Order[]>("/orders/history/me", "customer").then(setOrders);
  }, []);

  function toggleExpanded(orderId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">點餐紀錄</h1>
        <Link to="/order" className="text-sm text-blue-600">
          返回點餐
        </Link>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const expanded = expandedIds.has(order.id);
          return (
            <div key={order.id} className="rounded-xl bg-white shadow-sm">
              <button
                onClick={() => toggleExpanded(order.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm text-gray-500">
                  {order.closed_at ? new Date(order.closed_at).toLocaleString() : ""}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">NT$ {order.total_amount}</span>
                  <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
                </span>
              </button>

              {expanded && (
                <div className="border-t px-4 pb-4">
                  <div className="mt-2 text-sm text-gray-500">
                    付款方式：{order.payment_method === "cash" ? "現金" : "其他"}
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.product_name} x{item.quantity}</span>
                        <span>NT$ {item.subtotal}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 border-t pt-2 text-right font-semibold">合計 NT$ {order.total_amount}</div>
                </div>
              )}
            </div>
          );
        })}
        {orders.length === 0 && <p className="text-sm text-gray-400">目前還沒有點餐紀錄</p>}
      </div>
    </div>
  );
}
