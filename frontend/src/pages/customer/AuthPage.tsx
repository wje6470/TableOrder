import { FormEvent, useState } from "react";
import Card from "../../components/Card";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { tableConfig } from "../../lib/table";
import { ApiError } from "../../lib/api";
import { inputClass, mutedTextClass, primaryButtonClass } from "../../lib/ui";

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
    <div className="flex h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <Card className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="text-center">
            <p className={`text-sm ${mutedTextClass}`}>桌號 {tableConfig.get()}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {mode === "login" ? "登入點餐" : "註冊新帳號"}
            </h1>
          </div>

          <div className="space-y-3">
            <input
              className={inputClass}
              placeholder="手機號碼"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            {mode === "register" && (
              <input
                className={inputClass}
                placeholder="姓名（選填）"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
            <input
              className={inputClass}
              placeholder="密碼"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={loading} className={`w-full ${primaryButtonClass}`}>
            {mode === "login" ? "登入" : "註冊並登入"}
          </button>

          <button
            type="button"
            className="w-full text-center text-sm font-medium text-orange-600 dark:text-orange-400"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "還沒有帳號？前往註冊" : "已經有帳號？前往登入"}
          </button>
        </form>
      </Card>
    </div>
  );
}
