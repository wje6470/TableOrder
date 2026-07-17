import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { cardClass, mutedTextClass, primaryButtonClass } from "../../lib/ui";
import { CouponRule, Product } from "../../types";

const inputClass =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-orange-500/20";

function couponSummary(rule: { discount_type: "fixed" | "percentage"; discount_value: string }): string {
  return rule.discount_type === "fixed" ? `折 NT$ ${rule.discount_value}` : `${rule.discount_value}% 折扣`;
}

function DiscountValueInput({
  discountType,
  value,
  onChange,
}: {
  discountType: "fixed" | "percentage";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        className={`w-full ${inputClass} ${discountType === "percentage" ? "pr-14" : ""}`}
        type="number"
        min="0"
        placeholder={discountType === "fixed" ? "折抵金額（例如 50）" : "折扣百分比（例如 10）"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {discountType === "percentage" && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 dark:text-gray-500">
          % off
        </span>
      )}
    </div>
  );
}

interface RuleSectionProps {
  ruleType: "birthday" | "general";
  heading: string;
  description: string;
  rules: CouponRule[];
  products: Product[];
  onChanged: () => Promise<void>;
}

function RuleTypeSection({ ruleType, heading, description, rules, products, onChanged }: RuleSectionProps) {
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [productId, setProductId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function productName(id: string | null) {
    if (!id) return null;
    return products.find((p) => p.id === id)?.name ?? "已刪除的商品";
  }

  async function addRule(e: FormEvent) {
    e.preventDefault();
    if (!discountValue) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(
        "/coupons/rules",
        {
          rule_type: ruleType,
          title: title.trim() || null,
          discount_type: discountType,
          discount_value: Number(discountValue),
          product_id: productId || null,
        },
        "store"
      );
      setTitle("");
      setDiscountValue("");
      setProductId("");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "新增優惠券方案失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleRule(rule: CouponRule) {
    setError(null);
    try {
      await api.patch(`/coupons/rules/${rule.id}`, { is_enabled: !rule.is_enabled }, "store");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "切換方案狀態失敗，請再試一次");
    }
  }

  async function deleteRule(ruleId: string) {
    setError(null);
    try {
      await api.delete(`/coupons/rules/${ruleId}`, "store");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "刪除方案失敗，請再試一次");
    }
  }

  return (
    <div className={`${cardClass} p-6`}>
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">{heading}</h2>
      <p className={`mb-4 text-xs ${mutedTextClass}`}>{description}</p>

      <form onSubmit={addRule} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          className={`sm:col-span-2 ${inputClass}`}
          placeholder="優惠券標題（選填）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className={inputClass}
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as "fixed" | "percentage")}
        >
          <option value="fixed">固定金額折抵</option>
          <option value="percentage">百分比折扣</option>
        </select>
        <DiscountValueInput discountType={discountType} value={discountValue} onChange={setDiscountValue} />
        <select
          className={`sm:col-span-4 ${inputClass}`}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">不限定商品</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button disabled={submitting} className={`sm:col-span-4 ${primaryButtonClass}`}>
          新增方案
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {rule.title ?? (ruleType === "birthday" ? "生日優惠" : "優惠方案")}
              </p>
              <p className={`text-xs ${mutedTextClass}`}>
                {couponSummary(rule)}
                {rule.product_id && ` · 限定「${productName(rule.product_id)}」`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleRule(rule)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rule.is_enabled
                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                {rule.is_enabled ? "生效中" : "已停止"}
              </button>
              <button
                onClick={() => deleteRule(rule.id)}
                className="text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400"
              >
                刪除
              </button>
            </div>
          </li>
        ))}
        {rules.length === 0 && <p className={`text-sm ${mutedTextClass}`}>尚未新增任何方案</p>}
      </ul>
    </div>
  );
}

export default function CouponsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<CouponRule[]>([]);

  useEffect(() => {
    void api.get<Product[]>("/products").then(setProducts);
    void refreshRules();
  }, []);

  async function refreshRules() {
    const list = await api.get<CouponRule[]>("/coupons/rules", "store");
    setRules(list);
  }

  const generalRules = rules.filter((r) => r.rule_type === "general");
  const birthdayRules = rules.filter((r) => r.rule_type === "birthday");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">優惠券管理</h1>

      <RuleTypeSection
        ruleType="general"
        heading="一般優惠券方案"
        description="生效中的方案會發給還沒領過的顧客（含之後新註冊的顧客），停止後就不會再發給新顧客，但已經領到的優惠券仍可使用"
        rules={generalRules}
        products={products}
        onChanged={refreshRules}
      />

      <RuleTypeSection
        ruleType="birthday"
        heading="生日優惠券方案"
        description="生效中的方案，系統每天自動檢查，生日在本月份、今年還沒領過這個方案的顧客會自動收到一張"
        rules={birthdayRules}
        products={products}
        onChanged={refreshRules}
      />
    </div>
  );
}
