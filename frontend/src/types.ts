export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  is_available: boolean;
}

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
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
}
