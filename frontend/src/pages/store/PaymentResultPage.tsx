import { useSearchParams } from "react-router-dom";
import { cardClass, mutedTextClass } from "../../lib/ui";

const content: Record<string, { title: string; description: string; tone: string }> = {
  success: {
    title: "付款完成",
    description: "LINE Pay 付款已確認，這桌的訂單已經自動結帳。這個分頁可以關閉，回到店家平板繼續操作。",
    tone: "text-green-600 dark:text-green-400",
  },
  cancelled: {
    title: "已取消付款",
    description: "這筆 LINE Pay 付款已取消，訂單還沒結帳。回到店家平板可以重新選擇付款方式。",
    tone: "text-gray-500 dark:text-gray-400",
  },
  error: {
    title: "付款未完成",
    description: "LINE Pay 付款過程發生問題，訂單還沒結帳。回到店家平板可以重新建立付款請求。",
    tone: "text-red-600 dark:text-red-400",
  },
};

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const status = params.get("status") ?? "error";
  const info = content[status] ?? content.error;

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <div className={`${cardClass} max-w-sm p-8 text-center`}>
        <h1 className={`mb-3 text-xl font-bold ${info.tone}`}>{info.title}</h1>
        <p className={`text-sm ${mutedTextClass}`}>{info.description}</p>
      </div>
    </div>
  );
}
