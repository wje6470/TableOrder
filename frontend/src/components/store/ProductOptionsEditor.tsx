import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "../../lib/api";
import { primaryButtonClass, secondaryButtonClass } from "../../lib/ui";
import { Product, ProductOptionGroup } from "../../types";

interface Props {
  product: Product;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

interface OptionDraft {
  name: string;
  price_delta: string;
}

interface GroupDraft {
  name: string;
  selection_type: "single" | "multi";
  is_required: boolean;
  options: OptionDraft[];
}

const emptyDraft: GroupDraft = {
  name: "",
  selection_type: "single",
  is_required: false,
  options: [{ name: "", price_delta: "0" }],
};

function toPayload(draft: GroupDraft) {
  return {
    name: draft.name.trim(),
    selection_type: draft.selection_type,
    is_required: draft.is_required,
    options: draft.options
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), price_delta: Number(o.price_delta) || 0 })),
  };
}

function groupToDraft(group: ProductOptionGroup): GroupDraft {
  return {
    name: group.name,
    selection_type: group.selection_type,
    is_required: group.is_required,
    options: group.options.map((o) => ({ name: o.name, price_delta: o.price_delta })),
  };
}

const inputClass =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500";

function GroupForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  draft: GroupDraft;
  onChange: (draft: GroupDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  function updateOption(index: number, field: keyof OptionDraft, value: string) {
    onChange({
      ...draft,
      options: draft.options.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    });
  }

  function addOption() {
    onChange({ ...draft, options: [...draft.options, { name: "", price_delta: "0" }] });
  }

  function removeOption(index: number) {
    onChange({ ...draft, options: draft.options.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-600">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`flex-1 ${inputClass}`}
          placeholder="群組名稱（例如：甜度）"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
        <select
          className={inputClass}
          value={draft.selection_type}
          onChange={(e) => onChange({ ...draft, selection_type: e.target.value as "single" | "multi" })}
        >
          <option value="single">單選</option>
          <option value="multi">多選</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={draft.is_required}
            onChange={(e) => onChange({ ...draft, is_required: e.target.checked })}
            className="accent-orange-500"
          />
          必選
        </label>
      </div>

      <div className="space-y-2">
        {draft.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              className={`flex-1 ${inputClass}`}
              placeholder="選項名稱（例如：無糖）"
              value={option.name}
              onChange={(e) => updateOption(index, "name", e.target.value)}
            />
            <input
              className={`w-24 ${inputClass}`}
              type="number"
              placeholder="加價"
              value={option.price_delta}
              onChange={(e) => updateOption(index, "price_delta", e.target.value)}
            />
            <button
              onClick={() => removeOption(index)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={addOption}
          className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400"
        >
          <Plus className="h-3.5 w-3.5" />
          新增選項
        </button>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className={secondaryButtonClass}>
            取消
          </button>
        )}
        <button onClick={onSubmit} className={`${primaryButtonClass} px-4 py-2 text-sm`}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function ProductOptionsEditor({ product, onClose, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [newGroupDraft, setNewGroupDraft] = useState<GroupDraft>(emptyDraft);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<GroupDraft>(emptyDraft);

  async function createGroup() {
    if (!newGroupDraft.name.trim()) return;
    setError(null);
    try {
      await api.post(`/products/${product.id}/option-groups`, toPayload(newGroupDraft), "store");
      setNewGroupDraft(emptyDraft);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "新增選項群組失敗，請再試一次");
    }
  }

  function startEditing(group: ProductOptionGroup) {
    setEditingGroupId(group.id);
    setEditingDraft(groupToDraft(group));
  }

  async function saveEditing(groupId: string) {
    if (!editingDraft.name.trim()) return;
    setError(null);
    try {
      await api.put(`/products/${product.id}/option-groups/${groupId}`, toPayload(editingDraft), "store");
      setEditingGroupId(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新選項群組失敗，請再試一次");
    }
  }

  async function deleteGroup(groupId: string) {
    setError(null);
    try {
      await api.delete(`/products/${product.id}/option-groups/${groupId}`, "store");
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "刪除選項群組失敗，請再試一次");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{product.name}｜客製化選項</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          {product.option_groups.map((group) =>
            editingGroupId === group.id ? (
              <GroupForm
                key={group.id}
                draft={editingDraft}
                onChange={setEditingDraft}
                onSubmit={() => saveEditing(group.id)}
                onCancel={() => setEditingGroupId(null)}
                submitLabel="儲存"
              />
            ) : (
              <div key={group.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{group.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {group.selection_type === "single" ? "單選" : "可複選"}
                      {group.is_required ? "・必選" : ""}
                    </span>
                  </div>
                  <div className="flex gap-3 text-sm font-medium">
                    <button
                      onClick={() => startEditing(group)}
                      className="text-orange-600 dark:text-orange-400"
                    >
                      編輯
                    </button>
                    <button onClick={() => deleteGroup(group.id)} className="text-red-500 dark:text-red-400">
                      刪除
                    </button>
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  {group.options.map((option) => (
                    <li key={option.id} className="flex justify-between">
                      <span>{option.name}</span>
                      {Number(option.price_delta) > 0 && <span>+NT$ {option.price_delta}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          <GroupForm
            draft={newGroupDraft}
            onChange={setNewGroupDraft}
            onSubmit={createGroup}
            submitLabel="新增群組"
          />
        </div>
      </div>
    </div>
  );
}
