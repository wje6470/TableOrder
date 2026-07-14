import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { cardClass, mutedTextClass, primaryButtonClass, secondaryButtonClass } from "../../lib/ui";
import { BirthdayCouponRule, Product } from "../../types";

const inputClass =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-orange-500/20";

function couponSummary(c: { discount_type: "fixed" | "percentage"; discount_value: string }): string {
  return c.discount_type === "fixed" ? `折 NT$ ${c.discount_value}` : `${c.discount_value}% 折扣`;
}

function DiscountValueHint({ discountType }: { discountType: "fixed" | "percentage" }) {
  if (discountType !== "percentage") return null;
  return (
    <p className="col-span-full -mt-1 text-xs text-gray-400 dark:text-gray-500">
      請輸入「折扣的百分比」，不是「折」數。例如打 9 折（顧客付 90%）請輸入 10，不是 90。
    </p>
  );
}

export default function CouponsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const [bulkTitle, setBulkTitle] = useState("");
  const [bulkDiscountType, setBulkDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [bulkDiscountValue, setBulkDiscountValue] = useState("");
  const [bulkProductId, setBulkProductId] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const [birthdayRule, setBirthdayRule] = useState<BirthdayCouponRule | null>(null);
  const [birthdayProductId, setBirthdayProductId] = useState("");
  const [birthdayDiscountType, setBirthdayDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [birthdayDiscountValue, setBirthdayDiscountValue] = useState("");
  const [birthdayTitle, setBirthdayTitle] = useState("");
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [birthdaySaved, setBirthdaySaved] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get<Product[]>("/products").then(setProducts);
    void loadBirthdayRule();
  }, []);

  async function loadBirthdayRule() {
    const rule = await api.get<BirthdayCouponRule | null>("/coupons/birthday-rule", "store");
    setBirthdayRule(rule);
    if (rule) {
      setBirthdayProductId(rule.product_id);
      setBirthdayDiscountType(rule.discount_type);
      setBirthdayDiscountValue(rule.discount_value);
      setBirthdayTitle(rule.title ?? "");
      setBirthdayEnabled(rule.is_enabled);
    }
  }

  async function issueBulkCoupon(e: FormEvent) {
    e.preventDefault();
    if (!bulkDiscountValue) return;
    setError(null);
    setBulkMessage(null);
    try {
      const result = await api.post<{ issued_count: number }>(
        "/coupons/bulk",
        {
          title: bulkTitle.trim() || null,
          discount_type: bulkDiscountType,
          discount_value: Number(bulkDiscountValue),
          product_id: bulkProductId || null,
        },
        "store"
      );
      setBulkMessage(`已發放給 ${result.issued_count} 位顧客，僅限今日使用`);
      setBulkTitle("");
      setBulkDiscountValue("");
      setBulkProductId("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "發放節日優惠券失敗，請再試一次");
    }
  }

  async function saveBirthdayRule(e: FormEvent) {
    e.preventDefault();
    if (!birthdayProductId || !birthdayDiscountValue) return;
    setError(null);
    setBirthdaySaved(false);
    try {
      const rule = await api.put<BirthdayCouponRule>(
        "/coupons/birthday-rule",
        {
          product_id: birthdayProductId,
          discount_type: birthdayDiscountType,
          discount_value: Number(birthdayDiscountValue),
          title: birthdayTitle.trim() || null,
          is_enabled: birthdayEnabled,
        },
        "store"
      );
      setBirthdayRule(rule);
      setBirthdaySaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "儲存生日優惠規則失敗，請再試一次");
    }
  }

  const productOptions = (
    <>
      <option value="">不限定商品</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">優惠券管理</h1>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <div className={`${cardClass} p-6`}>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          節日優惠券（發給所有顧客）
        </h2>
        <p className={`mb-4 text-xs ${mutedTextClass}`}>按下發放後立即生效，僅限發放當天可以使用</p>
        <form onSubmit={issueBulkCoupon} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            className={`sm:col-span-2 ${inputClass}`}
            placeholder="優惠券標題（選填，例如：中秋節優惠）"
            value={bulkTitle}
            onChange={(e) => setBulkTitle(e.target.value)}
          />
          <select
            className={inputClass}
            value={bulkDiscountType}
            onChange={(e) => setBulkDiscountType(e.target.value as "fixed" | "percentage")}
          >
            <option value="fixed">固定金額折抵</option>
            <option value="percentage">百分比折扣</option>
          </select>
          <input
            className={inputClass}
            type="number"
            placeholder={bulkDiscountType === "fixed" ? "折抵金額（例如 50）" : "折扣百分比（例如 10）"}
            value={bulkDiscountValue}
            onChange={(e) => setBulkDiscountValue(e.target.value)}
          />
          <select
            className={`sm:col-span-4 ${inputClass}`}
            value={bulkProductId}
            onChange={(e) => setBulkProductId(e.target.value)}
          >
            {productOptions}
          </select>
          <DiscountValueHint discountType={bulkDiscountType} />
          {bulkMessage && <p className="col-span-full text-sm text-green-600 dark:text-green-400">{bulkMessage}</p>}
          <button className={`sm:col-span-4 ${primaryButtonClass}`}>發放給所有顧客（僅限今日使用）</button>
        </form>
      </div>

      <div className={`${cardClass} p-6`}>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">生日優惠券設定</h2>
        <p className={`mb-4 text-xs ${mutedTextClass}`}>
          系統每天自動檢查，生日在本月份的顧客會在今年內自動收到一張這裡設定的優惠券
        </p>
        <form onSubmit={saveBirthdayRule} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            className={`sm:col-span-2 ${inputClass}`}
            placeholder="優惠券標題（選填，例如：生日優惠）"
            value={birthdayTitle}
            onChange={(e) => setBirthdayTitle(e.target.value)}
          />
          <select
            className={inputClass}
            value={birthdayDiscountType}
            onChange={(e) => setBirthdayDiscountType(e.target.value as "fixed" | "percentage")}
          >
            <option value="fixed">固定金額折抵</option>
            <option value="percentage">百分比折扣</option>
          </select>
          <input
            className={inputClass}
            type="number"
            placeholder={birthdayDiscountType === "fixed" ? "折抵金額（例如 50）" : "折扣百分比（例如 10）"}
            value={birthdayDiscountValue}
            onChange={(e) => setBirthdayDiscountValue(e.target.value)}
          />
          <select
            className={`sm:col-span-3 ${inputClass}`}
            value={birthdayProductId}
            onChange={(e) => setBirthdayProductId(e.target.value)}
          >
            <option value="">請選擇限定商品（必選）</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={birthdayEnabled}
              onChange={(e) => setBirthdayEnabled(e.target.checked)}
              className="accent-orange-500"
            />
            啟用
          </label>
          <DiscountValueHint discountType={birthdayDiscountType} />
          {birthdaySaved && <p className="col-span-full text-sm text-green-600 dark:text-green-400">已儲存</p>}
          <button className={`sm:col-span-4 ${secondaryButtonClass}`}>儲存生日優惠規則</button>
        </form>
        {birthdayRule && (
          <p className={`mt-3 text-xs ${mutedTextClass}`}>
            目前規則：{birthdayRule.title ?? "生日優惠"} · {couponSummary(birthdayRule)} ·
            {birthdayRule.is_enabled ? " 啟用中" : " 已停用"}
          </p>
        )}
      </div>
    </div>
  );
}
