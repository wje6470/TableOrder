import { ChevronDown, Receipt, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { cardClass, mutedTextClass, secondaryButtonClass } from "../../lib/ui";
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
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-orange-500" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">點餐紀錄</h1>
          </div>
          <Link to="/order" className={secondaryButtonClass}>
            返回點餐
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className={`${cardClass} flex flex-col items-center justify-center px-6 py-16 text-center`}>
            <Receipt className="mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">過去尚未有點餐紀錄</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">結帳後這裡就會出現你的消費明細</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const expanded = expandedIds.has(order.id);
              return (
                <div
                  key={order.id}
                  className={`${cardClass} overflow-hidden transition-shadow duration-200 hover:shadow-soft-md`}
                >
                  <button
                    onClick={() => toggleExpanded(order.id)}
                    className="flex w-full items-center justify-between p-5 text-left"
                  >
                    <div>
                      <span className={`block text-sm ${mutedTextClass}`}>
                        {order.closed_at ? new Date(order.closed_at).toLocaleString() : ""}
                      </span>
                      <span className={`mt-0.5 block text-xs ${mutedTextClass}`}>{order.items.length} 項餐點</span>
                    </div>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">NT$ {order.total_amount}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-100 px-5 pb-5 dark:border-gray-700">
                      <div className={`mt-3 text-sm ${mutedTextClass}`}>
                        付款方式：
                        {order.payment_method === "cash"
                          ? "現金"
                          : order.payment_method === "linepay"
                            ? "LINE Pay"
                            : order.payment_method === "paypal"
                              ? "PayPal"
                              : "其他"}
                      </div>
                      <ul className="mt-2 space-y-1.5 text-sm text-gray-800 dark:text-gray-200">
                        {order.items.map((item) => (
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
                      <div className="mt-3 border-t border-gray-100 pt-3 text-right font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                        合計 NT$ {order.total_amount}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
