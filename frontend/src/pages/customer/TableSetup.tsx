import { FormEvent, useState } from "react";
import Card from "../../components/Card";
import { tableConfig } from "../../lib/table";
import { inputClass, mutedTextClass, primaryButtonClass } from "../../lib/ui";

export default function TableSetup({ onDone }: { onDone: () => void }) {
  const [tableNumber, setTableNumber] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tableNumber.trim()) return;
    tableConfig.set(tableNumber.trim());
    onDone();
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <Card className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">平板初始設定</h1>
            <p className={`mt-2 text-sm ${mutedTextClass}`}>此平板僅需設定一次，設定後即代表這張桌子。</p>
          </div>
          <input
            className={inputClass}
            placeholder="請輸入桌號，例如 A1"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
          />
          <button type="submit" className={`w-full ${primaryButtonClass}`}>
            確認設定
          </button>
        </form>
      </Card>
    </div>
  );
}
