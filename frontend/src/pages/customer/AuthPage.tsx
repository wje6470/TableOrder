import { FormEvent, useState } from "react";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { tableConfig } from "../../lib/table";
import { ApiError } from "../../lib/api";

export default function AuthPage() {
  const { login, register } = useCustomerAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(phone, password);
      } else {
        await register(phone, password, name || undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "發生錯誤，請再試一次");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow dark:bg-gray-800">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">桌號 {tableConfig.get()}</p>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {mode === "login" ? "登入點餐" : "註冊新帳號"}
          </h1>
        </div>

        <input
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          placeholder="手機號碼"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
        {mode === "register" && (
          <input
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            placeholder="姓名（選填）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          placeholder="密碼"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 text-lg font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {mode === "login" ? "登入" : "註冊並登入"}
        </button>

        <button
          type="button"
          className="w-full text-sm text-blue-600 dark:text-blue-400"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "還沒有帳號？前往註冊" : "已經有帳號？前往登入"}
        </button>
      </form>
    </div>
  );
}
