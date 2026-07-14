import { useMemo, useState } from "react";
import { StickyNote, X } from "lucide-react";
import { primaryButtonClass, secondaryButtonClass } from "../lib/ui";
import { Product } from "../types";

interface Props {
  product: Product;
  onConfirm: (selectedOptionIds: string[], note: string) => void;
  onClose: () => void;
}

export default function ProductOptionsModal({ product, onConfirm, onClose }: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");

  function selectSingle(groupId: string, optionId: string) {
    setSelections((prev) => ({ ...prev, [groupId]: [optionId] }));
  }

  function toggleMulti(groupId: string, optionId: string) {
    setSelections((prev) => {
      const current = prev[groupId] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [groupId]: next };
    });
  }

  const isValid = useMemo(
    () => product.option_groups.every((group) => !group.is_required || (selections[group.id]?.length ?? 0) > 0),
    [product.option_groups, selections]
  );

  const extraPrice = useMemo(() => {
    const selectedIds = new Set(Object.values(selections).flat());
    return product.option_groups
      .flatMap((group) => group.options)
      .filter((option) => selectedIds.has(option.id))
      .reduce((sum, option) => sum + Number(option.price_delta), 0);
  }, [product.option_groups, selections]);

  function confirm() {
    if (!isValid) return;
    onConfirm(Object.values(selections).flat(), note.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800 sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{product.name}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {product.option_groups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 flex items-center gap-2">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200">{group.name}</h4>
                {group.is_required && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                    必選
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {group.selection_type === "single" ? "單選" : "可複選"}
                </span>
              </div>
              <div className="space-y-2">
                {group.options.map((option) => {
                  const checked = (selections[group.id] ?? []).includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                        checked
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <input
                          type={group.selection_type === "single" ? "radio" : "checkbox"}
                          name={group.id}
                          checked={checked}
                          onChange={() =>
                            group.selection_type === "single"
                              ? selectSingle(group.id, option.id)
                              : toggleMulti(group.id, option.id)
                          }
                          className="accent-orange-500"
                        />
                        {option.name}
                      </span>
                      {Number(option.price_delta) > 0 && (
                        <span className="text-orange-500 dark:text-orange-400">
                          +NT$ {option.price_delta}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <StickyNote className="h-4 w-4 text-gray-400" />
              <h4 className="font-semibold text-gray-800 dark:text-gray-200">備註</h4>
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註"
              maxLength={200}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 p-5 dark:border-gray-700">
          <button onClick={onClose} className={secondaryButtonClass}>
            取消
          </button>
          <button
            onClick={confirm}
            disabled={!isValid}
            className={`flex-1 ${primaryButtonClass}`}
          >
            加入購物車{extraPrice > 0 ? `（+NT$ ${extraPrice}）` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
