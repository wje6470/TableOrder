import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { Order } from "../../types";

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    void api.get<Order[]>("/orders/history/me", "customer").then(setOrders);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">點餐紀錄</h1>
        <Link to="/order" className="text-sm text-blue-600">
          返回點餐
        </Link>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{order.closed_at ? new Date(order.closed_at).toLocaleString() : ""}</span>
              <span>付款方式：{order.payment_method === "cash" ? "現金" : "其他"}</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>x{item.quantity}</span>
                  <span>NT$ {item.subtotal}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t pt-2 text-right font-semibold">合計 NT$ {order.total_amount}</div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-gray-400">目前還沒有點餐紀錄</p>}
      </div>
    </div>
  );
}
