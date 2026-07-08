import { FormEvent, useState } from "react";
import { tableConfig } from "../../lib/table";

export default function TableSetup({ onDone }: { onDone: () => void }) {
  const [tableNumber, setTableNumber] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tableNumber.trim()) return;
    tableConfig.set(tableNumber.trim());
    onDone();
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold text-gray-800">平板初始設定</h1>
        <p className="text-sm text-gray-500">此平板僅需設定一次，設定後即代表這張桌子。</p>
        <input
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg"
          placeholder="請輸入桌號，例如 A1"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
        />
        <button type="submit" className="w-full rounded-lg bg-blue-600 py-3 text-lg font-semibold text-white">
          確認設定
        </button>
      </form>
    </div>
  );
}
