import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { cardClass, mutedTextClass } from "../../lib/ui";
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
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">點餐紀錄</h1>
          <Link to="/order" className="text-sm font-medium text-orange-600 dark:text-orange-400">
            返回點餐
          </Link>
        </div>

        <div className="space-y-4">
          {orders.map((order) => {
            const expanded = expandedIds.has(order.id);
            return (
              <div key={order.id} className={`${cardClass} overflow-hidden`}>
                <button
                  onClick={() => toggleExpanded(order.id)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <span className={`text-sm ${mutedTextClass}`}>
                    {order.closed_at ? new Date(order.closed_at).toLocaleString() : ""}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">NT$ {order.total_amount}</span>
                    <span className="text-gray-400 dark:text-gray-500">{expanded ? "▲" : "▼"}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 dark:border-gray-700">
                    <div className={`mt-3 text-sm ${mutedTextClass}`}>
                      付款方式：{order.payment_method === "cash" ? "現金" : "其他"}
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-gray-800 dark:text-gray-200">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span>{item.product_name} x{item.quantity}</span>
                          <span>NT$ {item.subtotal}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 border-t border-gray-100 pt-3 text-right font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                      合計 NT$ {order.total_amount}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {orders.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">目前還沒有點餐紀錄</p>}
        </div>
      </div>
    </div>
  );
}
