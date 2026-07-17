import { Coupon, Order } from "../types";

export function previewDiscount(order: Order, coupon: Coupon): { discount: number; applicable: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  if (coupon.valid_until && coupon.valid_until < today) {
    return { discount: 0, applicable: false };
  }

  let base = Number(order.total_amount);
  if (coupon.product_id) {
    base = order.items
      .filter((item) => item.product_id === coupon.product_id)
      .reduce((sum, item) => sum + Number(item.subtotal), 0);
    if (base <= 0) return { discount: 0, applicable: false };
  }

  const value = Number(coupon.discount_value);
  const discount = coupon.discount_type === "fixed" ? value : Math.round(base * (value / 100) * 100) / 100;
  return { discount: Math.min(discount, base), applicable: true };
}
