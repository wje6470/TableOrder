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
  created_at: string;
}

export interface Order {
  id: string;
  table_id: string;
  customer_id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  payment_method: "cash" | "other" | null;
  paid_amount: string | null;
  total_amount: string;
  items: OrderItem[];
}

export interface CartLine {
  product: Product;
  quantity: number;
  note: string;
  selectedOptionIds: string[];
}
