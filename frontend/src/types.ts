export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface ProductOption {
  id: string;
  name: string;
  price_delta: string;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  selection_type: "single" | "multi";
  is_required: boolean;
  options: ProductOption[];
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  is_available: boolean;
  option_groups: ProductOptionGroup[];
}

export interface OrderItemOption {
  group_name: string;
  option_name: string;
  price_delta: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  note: string | null;
  options: OrderItemOption[];
  is_completed: boolean;
  created_at: string;
}

export interface KitchenTicket {
  id: string;
  order_id: string;
  table_id: string;
  created_at: string;
  items: OrderItem[];
}

export interface Order {
  id: string;
  table_id: string;
  customer_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  payment_method: "cash" | "linepay" | "paypal" | null;
  paid_amount: string | null;
  total_amount: string;
  discount_amount: string;
  items: OrderItem[];
}

export interface Coupon {
  id: string;
  customer_id: string;
  order_id: string | null;
  product_id: string | null;
  title: string | null;
  discount_type: "fixed" | "percentage";
  discount_value: string;
  valid_until: string | null;
  source: "manual" | "bulk" | "birthday" | "general";
  is_used: boolean;
  used_at: string | null;
  created_at: string;
}

export interface CouponRule {
  id: string;
  rule_type: "birthday" | "general";
  product_id: string | null;
  discount_type: "fixed" | "percentage";
  discount_value: string;
  title: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartLine {
  product: Product;
  quantity: number;
  note: string;
  selectedOptionIds: string[];
}

export interface RecommendedProduct {
  product: Product;
  reason: string | null;
  source: "ai" | "popular";
}
