import { Receipt, StickyNote, X } from "lucide-react";
import { previewDiscount } from "../lib/coupon";
import { mutedTextClass, secondaryButtonClass } from "../lib/ui";
import { Coupon, Order } from "../types";

interface Props {
  order: Order;
  coupon: Coupon | null;
  onClose: () => void;
}

export default function OrderSummaryModal({ order, coupon, onClose }: Props) {
  const preview = coupon ? previewDiscount(order, coupon) : null;
  const discount = preview?.applicable ? preview.discount : 0;
  const payable = Number(order.total_amount) - discount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
              本次消費（尚未結帳）
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {order.items.length === 0 ? (
          <p className={`text-sm ${mutedTextClass}`}>目前還沒有送出任何餐點</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm text-gray-800 dark:text-gray-200">
            {order.items.map((item) => (
              <li key={item.id}>
                <div className="flex justify-between">
                  <span>
                    {item.product_name} x{item.quantity}
                  </span>
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
        )}

        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>小計</span>
            <span>NT$ {order.total_amount}</span>
          </div>
          {coupon && preview?.applicable && (
            <div className="mt-1 flex items-center justify-between text-sm text-orange-600 dark:text-orange-400">
              <span>優惠券：{coupon.title ?? "折扣"}</span>
              <span>-NT$ {discount}</span>
            </div>
          )}
          {coupon && preview && !preview.applicable && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              已套用的優惠券{coupon.product_id ? "（尚未點限定商品）" : "（已過期）"}目前不適用
            </p>
          )}
          <div className="mt-1 flex items-center justify-between text-lg font-bold text-gray-900 dark:text-gray-100">
            <span>目前消費金額</span>
            <span>NT$ {payable.toFixed(2)}</span>
          </div>
        </div>

        <button onClick={onClose} className={`mt-4 w-full ${secondaryButtonClass}`}>
          關閉
        </button>
      </div>
    </div>
  );
}
