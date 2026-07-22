import { ChevronRight, Clock, Minus, Plus, Receipt, Search, ShoppingCart, Sparkles, StickyNote, Trash2, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MoodQuizPanel from "../../components/customer/MoodQuizPanel";
import OrderSummaryModal from "../../components/OrderSummaryModal";
import ProductOptionsModal from "../../components/ProductOptionsModal";
import ThemeToggle from "../../components/ThemeToggle";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { api, ApiError } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { tableConfig } from "../../lib/table";
import { categoryPillClass, mutedTextClass, pillInputClass, primaryButtonClass, secondaryButtonClass } from "../../lib/ui";
import { CartLine, Category, Coupon, Order, Product, RecommendedProduct } from "../../types";

function couponLabel(coupon: Coupon, products: Product[]): string {
  const discount = coupon.discount_type === "fixed" ? `折 NT$ ${coupon.discount_value}` : `${coupon.discount_value}% 折扣`;
  const parts = [discount];
  if (coupon.product_id) {
    const productName = products.find((p) => p.id === coupon.product_id)?.name ?? "特定商品";
    parts.push(`限點 ${productName}`);
  }
  if (coupon.valid_until) {
    parts.push(`限 ${coupon.valid_until} 前使用`);
  }
  const detail = parts.join("・");
  return coupon.title ? `${coupon.title}（${detail}）` : detail;
}

function isCouponUsable(coupon: Coupon): boolean {
  if (coupon.is_used || coupon.order_id !== null) return false;
  if (!coupon.valid_until) return true;
  const today = new Date().toISOString().slice(0, 10);
  return coupon.valid_until >= today;
}

const MOOD_QUIZ_TAB = "__mood_quiz__";

function optionsKey(selectedOptionIds: string[]): string {
  return [...selectedOptionIds].sort().join(",");
}

function lineKey(line: CartLine): string {
  return `${line.product.id}::${optionsKey(line.selectedOptionIds)}::${line.note}`;
}

function lineUnitPrice(line: CartLine): number {
  const options = line.product.option_groups.flatMap((group) => group.options);
  const optionsTotal = line.selectedOptionIds.reduce((sum, id) => {
    const option = options.find((o) => o.id === id);
    return sum + (option ? Number(option.price_delta) : 0);
  }, 0);
  return Number(line.product.price) + optionsTotal;
}

function lineOptionNames(line: CartLine): string {
  return line.product.option_groups
    .flatMap((group) => group.options)
    .filter((option) => line.selectedOptionIds.includes(option.id))
    .map((option) => option.name)
    .join("、");
}

export default function OrderingPage() {
  const { logout } = useCustomerAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);

  const tableNumber = tableConfig.get() ?? "";

  useEffect(() => {
    void loadMenu();
    void openOrder();
    void loadCoupons();
    void loadRecommendations();
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
      if (err instanceof ApiError && err.status === 409) {
        // 這桌目前還有別的帳號尚未結帳的訂單（正常情況下不會發生，一桌一平板）。
        // 一旦店員完成結帳，CustomerGate 會偵測到桌況變回 idle 並自動登出，
        // 讓這裡的顧客可以重新登入、正常開始點餐，不需要額外處理。
        setBlockedMessage(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : "無法開始點餐，請通知店員");
      }
    }
  }

  async function loadCoupons() {
    const list = await api.get<Coupon[]>("/coupons/me", "customer");
    setCoupons(list);
  }

  async function loadRecommendations() {
    try {
      const list = await api.get<RecommendedProduct[]>("/customers/me/recommendations", "customer");
      setRecommendations(list);
    } catch {
      // 推薦是錦上添花的功能，失敗就不顯示，不影響正常點餐。
      setRecommendations([]);
    }
  }

  async function applyCoupon() {
    if (!order || !selectedCouponId) return;
    try {
      await api.post(`/coupons/${selectedCouponId}/apply`, { order_id: order.id }, "customer");
      setSelectedCouponId("");
      await loadCoupons();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "套用優惠券失敗，請再試一次");
    }
  }

  async function unapplyCoupon(couponId: string) {
    try {
      await api.post(`/coupons/${couponId}/unapply`, {}, "customer");
      await loadCoupons();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消優惠券失敗，請再試一次");
    }
  }

  function addLineToCart(product: Product, selectedOptionIds: string[], note: string) {
    const key = `${optionsKey(selectedOptionIds)}::${note}`;
    setCart((prev) => {
      const existing = prev.find(
        (line) => line.product.id === product.id && `${optionsKey(line.selectedOptionIds)}::${line.note}` === key
      );
      if (existing) {
        return prev.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...prev, { product, quantity: 1, note, selectedOptionIds }];
    });
  }

  function addToCart(product: Product) {
    setCustomizingProduct(product);
  }

  function confirmCustomization(selectedOptionIds: string[], note: string) {
    if (customizingProduct) addLineToCart(customizingProduct, selectedOptionIds, note);
    setCustomizingProduct(null);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev.map((line) => (lineKey(line) === key ? { ...line, quantity: line.quantity + delta } : line)).filter((line) => line.quantity > 0)
    );
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((line) => lineKey(line) !== key));
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = activeCategory === "all" || product.category_id === activeCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + lineUnitPrice(line) * line.quantity, 0),
    [cart]
  );
  const cartItemCount = cart.reduce((count, line) => count + line.quantity, 0);

  const orderedTotal = order ? Number(order.total_amount) : 0;

  const appliedCoupon = coupons.find((c) => c.order_id === order?.id && !c.is_used);
  const availableCoupons = coupons.filter(isCouponUsable);

  async function submitCart() {
    if (!order || cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.post<Order>(
        `/orders/${order.id}/items`,
        {
          items: cart.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
            note: line.note.trim() || undefined,
            selected_option_ids: line.selectedOptionIds,
          })),
        },
        "customer"
      );
      setOrder(updated);
      setCart([]);
      setIsCartOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "送出失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  if (blockedMessage) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center dark:bg-gray-900">
        <Clock className="h-12 w-12 text-orange-500" />
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">此桌尚未結帳，請稍候</h1>
        <p className={`max-w-sm text-sm ${mutedTextClass}`}>{blockedMessage}</p>
        <p className={`max-w-sm text-sm ${mutedTextClass}`}>
          店員完成結帳後這裡會自動回到登入畫面，屆時請重新登入即可開始點餐。
        </p>
        <button onClick={logout} className={secondaryButtonClass}>
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="flex w-full flex-1 flex-col">
        <header className="z-10 flex flex-col items-start justify-between gap-3 bg-white p-4 shadow-sm dark:bg-gray-800 dark:shadow-none dark:border-b dark:border-gray-700 sm:p-6 md:flex-row md:items-center">
          <div className="flex-shrink-0 whitespace-nowrap">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
              桌號 {tableNumber}
            </h1>
            <p className={`mt-1 text-sm ${mutedTextClass}`}>已累計消費 NT$ {orderedTotal}</p>
          </div>
          <div className="flex w-full flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center md:w-auto">
            <div className="relative w-full sm:w-64">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="搜尋餐點..."
                className={pillInputClass}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link to="/order/history" className={secondaryButtonClass}>
                點餐紀錄
              </Link>
              <ThemeToggle />
              <button onClick={logout} className={secondaryButtonClass}>
                登出
              </button>
              <button
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="relative flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 dark:shadow-none"
              >
                <ShoppingCart className="h-5 w-5" />
                查看購物車
                {cartItemCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-xs font-bold text-white dark:border-gray-800">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {recommendations.length > 0 && (
          <div className="hide-scrollbar overflow-x-auto border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
              <Sparkles className="h-4 w-4" />
              為你推薦
            </div>
            <div className="flex gap-3">
              {recommendations.map((rec) => (
                <button
                  key={rec.product.id}
                  onClick={() => addToCart(rec.product)}
                  disabled={!rec.product.is_available}
                  className="flex w-56 flex-shrink-0 flex-col items-start rounded-xl border border-orange-100 bg-orange-50/60 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-500/20 dark:bg-orange-500/5"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{rec.product.name}</span>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      NT$ {rec.product.price}
                    </span>
                  </div>
                  {rec.reason && (
                    <p className={`mt-1 line-clamp-2 text-xs ${mutedTextClass}`}>{rec.reason}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="hide-scrollbar overflow-x-auto border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-4">
          <div className="flex gap-2">
            <button onClick={() => setActiveCategory("all")} className={categoryPillClass(activeCategory === "all")}>
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              全部餐點
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={categoryPillClass(activeCategory === category.id)}
              >
                {category.name}
              </button>
            ))}
            <button
              onClick={() => setActiveCategory(MOOD_QUIZ_TAB)}
              className={categoryPillClass(activeCategory === MOOD_QUIZ_TAB)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI 今日推薦
            </button>
          </div>
        </div>

        {error && (
          <p className="bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400 sm:px-6">
            {error}
          </p>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeCategory === MOOD_QUIZ_TAB ? (
            <MoodQuizPanel onAddToCart={addToCart} />
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <Search className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium">找不到相關餐點</p>
              <p className="mt-1 text-sm">請試試其他關鍵字或分類</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:shadow-none"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                        尚無圖片
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-sm font-bold text-orange-600 shadow-sm backdrop-blur-sm dark:bg-gray-900/80 dark:text-orange-400">
                      NT$ {product.price}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="mb-2 font-bold text-gray-900 dark:text-gray-100">{product.name}</h3>
                    {product.is_available ? (
                      <button
                        onClick={() => addToCart(product)}
                        className="mt-auto flex w-full items-center justify-center rounded-xl bg-orange-50 py-2.5 font-semibold text-orange-600 transition-colors duration-200 hover:bg-orange-500 hover:text-white dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500 dark:hover:text-white"
                      >
                        <Plus className="mr-1 h-5 w-5" />
                        加入購物車
                      </button>
                    ) : (
                      <div className="mt-auto flex w-full items-center justify-center rounded-xl bg-gray-100 py-2.5 font-semibold text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                        已售完
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {isCartOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" onClick={() => setIsCartOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full transform flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-800 dark:border-l dark:border-gray-700 md:w-96 ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-700">
          <div className="flex items-center">
            <ShoppingCart className="mr-3 h-6 w-6 text-orange-500" />
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">購物車</h2>
            <span className="ml-3 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
              {cartItemCount} 項
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              onClick={() => setShowSummary(true)}
              title="本次消費（尚未結帳）"
            >
              <Receipt className="h-5 w-5" />
            </button>
            <button
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              onClick={() => setIsCartOpen(false)}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <ShoppingCart className="h-10 w-10 text-gray-300 dark:text-gray-500" />
              </div>
              <p className="font-medium text-gray-500 dark:text-gray-400">購物車是空的</p>
              <p className="mt-1 text-sm">快去挑選一些餐點吧！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((line) => {
                const key = lineKey(line);
                const unitPrice = lineUnitPrice(line);
                const optionNames = lineOptionNames(line);
                return (
                  <div
                    key={key}
                    className="group relative flex rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    {line.product.image_url ? (
                      <img
                        src={line.product.image_url}
                        alt={line.product.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                        無圖片
                      </div>
                    )}
                    <div className="ml-4 flex flex-1 flex-col justify-between">
                      <div>
                        <h4 className="line-clamp-1 font-semibold text-gray-800 dark:text-gray-100">
                          {line.product.name}
                        </h4>
                        {optionNames && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                            {optionNames}
                          </p>
                        )}
                        <p className="mt-1 text-sm font-bold text-orange-500 dark:text-orange-400">
                          NT$ {unitPrice}
                        </p>
                        {line.note && (
                          <div className="mt-1 flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <StickyNote className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-2">{line.note}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                          <button
                            onClick={() => changeQuantity(key, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-gray-600 shadow-sm transition-colors hover:text-orange-500 dark:bg-gray-800 dark:text-gray-200"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                            {line.quantity}
                          </span>
                          <button
                            onClick={() => changeQuantity(key, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-gray-600 shadow-sm transition-colors hover:text-orange-500 dark:bg-gray-800 dark:text-gray-200"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="font-bold text-gray-800 dark:text-gray-100">
                          NT$ {unitPrice * line.quantity}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(key)}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 opacity-0 shadow-sm transition-opacity hover:text-red-500 group-hover:opacity-100 dark:border-gray-600 dark:bg-gray-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 p-6 dark:border-gray-700">
          {appliedCoupon ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                已套用：{couponLabel(appliedCoupon, products)}
              </span>
              <button
                onClick={() => unapplyCoupon(appliedCoupon.id)}
                className="text-xs font-medium text-red-500 dark:text-red-400"
              >
                取消
              </button>
            </div>
          ) : (
            availableCoupons.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <select
                  value={selectedCouponId}
                  onChange={(e) => setSelectedCouponId(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">選擇優惠券</option>
                  {availableCoupons.map((c) => (
                    <option key={c.id} value={c.id}>
                      {couponLabel(c, products)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={applyCoupon}
                  disabled={!selectedCouponId}
                  className="text-xs font-medium text-orange-600 disabled:opacity-40 dark:text-orange-400"
                >
                  套用
                </button>
              </div>
            )
          )}
          <div className="mb-4 flex items-end justify-between border-t border-dashed border-gray-200 pt-4 dark:border-gray-700">
            <span className="font-medium text-gray-800 dark:text-gray-200">小計</span>
            <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">NT$ {cartTotal}</span>
          </div>
          <button
            disabled={cart.length === 0 || submitting}
            onClick={submitCart}
            className={`flex w-full items-center justify-center ${primaryButtonClass}`}
          >
            送出點餐
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </aside>

      {customizingProduct && (
        <ProductOptionsModal
          product={customizingProduct}
          onConfirm={confirmCustomization}
          onClose={() => setCustomizingProduct(null)}
        />
      )}

      {showSummary && order && (
        <OrderSummaryModal order={order} coupon={appliedCoupon ?? null} onClose={() => setShowSummary(false)} />
      )}
    </div>
  );
}
