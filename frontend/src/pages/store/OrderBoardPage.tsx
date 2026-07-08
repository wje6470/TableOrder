import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
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
      <h1 className="mb-4 text-lg font-bold">即時訂單看板</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">桌號 {tableNumberOf(order.table_id)}</h2>
              <span className="text-xs text-gray-400">{new Date(order.opened_at).toLocaleTimeString()}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>x{item.quantity}</span>
                  <span>NT$ {item.subtotal}</span>
                </li>
              ))}
              {order.items.length === 0 && <li className="text-gray-400">尚未點餐</li>}
            </ul>
            <div className="mt-2 border-t pt-2 text-right font-semibold">合計 NT$ {order.total_amount}</div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-gray-400">目前沒有使用中的桌次</p>}
      </div>
    </div>
  );
}
