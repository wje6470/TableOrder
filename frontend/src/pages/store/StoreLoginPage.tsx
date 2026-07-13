import { FormEvent, useState } from "react";
import Card from "../../components/Card";
import { useStoreAuth } from "../../context/StoreAuthContext";
import { ApiError } from "../../lib/api";
import { inputClass, primaryButtonClass } from "../../lib/ui";

export default function StoreLoginPage() {
  const { login } = useStoreAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <Card className="w-full max-w-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">店家後台登入</h1>
          <div className="space-y-3">
            <input
              className={inputClass}
              placeholder="帳號"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
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
            登入
          </button>
        </form>
      </Card>
    </div>
  );
}
