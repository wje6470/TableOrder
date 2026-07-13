import { StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { cardClass, mutedTextClass } from "../../lib/ui";
import { Order } from "../../types";

interface TableInfo {
  id: string;
  table_number: string;
}

export default function OrderBoardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel("store-order-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">即時訂單看板</h1>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <div key={order.id} className={`${cardClass} p-5`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                桌號 {tableNumberOf(order.table_id)}
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(order.opened_at).toLocaleTimeString()}
              </span>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-800 dark:text-gray-200">
              {order.items.map((item) => (
                <li key={item.id}>
                  <div className="flex justify-between">
                    <span>{item.product_name} x{item.quantity}</span>
                    <span>NT$ {item.subtotal}</span>
                  </div>
                  {item.note && (
                    <div className="mt-0.5 flex items-start gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                      <StickyNote className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>{item.note}</span>
                    </div>
                  )}
                </li>
              ))}
              {order.items.length === 0 && <li className="text-gray-400 dark:text-gray-500">尚未點餐</li>}
            </ul>
            <div className="mt-3 border-t border-gray-100 pt-3 text-right font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              合計 NT$ {order.total_amount}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className={mutedTextClass}>目前沒有使用中的桌次</p>}
      </div>
    </div>
  );
}
