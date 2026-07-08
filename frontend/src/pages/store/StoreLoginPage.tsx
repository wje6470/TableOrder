import { FormEvent, useState } from "react";
import { useStoreAuth } from "../../context/StoreAuthContext";
import { ApiError } from "../../lib/api";

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
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold text-gray-800">店家後台登入</h1>
        <input
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg"
          placeholder="帳號"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg"
          placeholder="密碼"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          登入
        </button>
      </form>
    </div>
  );
}
