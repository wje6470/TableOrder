import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../../components/ThemeToggle";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { api, ApiError } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { tableConfig } from "../../lib/table";
import { CartLine, Category, Order, Product } from "../../types";

export default function OrderingPage() {
  const { logout } = useCustomerAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tableNumber = tableConfig.get() ?? "";

  useEffect(() => {
    void loadMenu();
    void openOrder();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("products-availability")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void loadMenu();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadMenu() {
    const [cats, prods] = await Promise.all([
      api.get<Category[]>("/categories"),
      api.get<Product[]>("/products"),
    ]);
    setCategories(cats);
    setProducts(prods);
  }

  async function openOrder() {
    try {
      const current = await api.post<Order>("/orders/open", { table_number: tableNumber }, "customer");
      setOrder(current);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "無法開始點餐，請通知店員");
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0),
    [cart]
  );

  const orderedTotal = order ? Number(order.total_amount) : 0;

  async function submitCart() {
    if (!order || cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.post<Order>(
        `/orders/${order.id}/items`,
        { items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity })) },
        "customer"
      );
      setOrder(updated);
      setCart([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "送出失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow dark:bg-gray-800">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">桌號 {tableNumber}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">已累計消費 NT$ {orderedTotal}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/order/history"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            點餐紀錄
          </Link>
          <ThemeToggle className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" />
          <button
            onClick={logout}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            登出
          </button>
        </div>
      </header>

      {error && (
        <p className="bg-red-50 px-6 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {categories.map((category) => (
            <section key={category.id} className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">{category.name}</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {products
                  .filter((p) => p.category_id === category.id)
                  .map((product) => (
                    <button
                      key={product.id}
                      disabled={!product.is_available}
                      onClick={() => addToCart(product)}
                      className={`overflow-hidden rounded-xl border text-left shadow-sm transition ${
                        product.is_available
                          ? "border-gray-200 bg-white hover:border-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
                          : "border-gray-200 bg-gray-100 opacity-50 dark:border-gray-700 dark:bg-gray-800"
                      }`}
                    >
                      {product.image_url ? (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-xs text-gray-400 dark:bg-gray-900 dark:text-gray-500">
                          尚無圖片
                        </div>
                      )}
                      <div className="p-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">NT$ {product.price}</p>
                        {!product.is_available && (
                          <p className="mt-1 text-xs text-red-500 dark:text-red-400">已售完</p>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </main>

        <aside className="w-80 border-l bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">本次購物車</h2>
          <div className="space-y-2">
            {cart.map((line) => (
              <div key={line.product.id} className="flex items-center justify-between text-sm text-gray-800 dark:text-gray-200">
                <span>{line.product.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
                    onClick={() => changeQuantity(line.product.id, -1)}
                  >
                    -
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
                    onClick={() => changeQuantity(line.product.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">尚未選擇商品</p>}
          </div>

          <div className="mt-4 border-t pt-4 dark:border-gray-700">
            <p className="mb-2 text-sm text-gray-800 dark:text-gray-200">小計 NT$ {cartTotal}</p>
            <button
              disabled={cart.length === 0 || submitting}
              onClick={submitCart}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              送出點餐
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
