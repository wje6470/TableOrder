import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { cardClass, mutedTextClass, primaryButtonClass, secondaryButtonClass } from "../../lib/ui";
import { MoodQuizQuestion, Product, RecommendedProduct } from "../../types";

interface Props {
  onAddToCart: (product: Product) => void;
}

type Status = "loading" | "answering" | "submitting" | "result" | "error";

export default function MoodQuizPanel({ onAddToCart }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [questions, setQuestions] = useState<MoodQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadQuestions();
  }, []);

  async function loadQuestions() {
    setStatus("loading");
    setError(null);
    setAnswers({});
    try {
      const list = await api.get<MoodQuizQuestion[]>("/customers/me/mood-quiz/questions", "customer");
      setQuestions(list);
      setStatus("answering");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "出題失敗，請再試一次");
      setStatus("error");
    }
  }

  function selectAnswer(index: number, option: string) {
    setAnswers((prev) => ({ ...prev, [index]: option }));
  }

  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i]);

  async function submitAnswers() {
    if (!allAnswered) return;
    setStatus("submitting");
    setError(null);
    try {
      const payload = {
        answers: questions.map((q, i) => ({ question: q.question, answer: answers[i] })),
      };
      const result = await api.post<RecommendedProduct[]>("/customers/me/mood-quiz/recommend", payload, "customer");
      setRecommendations(result);
      setStatus("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "推薦失敗，請再試一次");
      setStatus("error");
    }
  }

  if (status === "loading" || status === "submitting") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <Sparkles className="mb-4 h-12 w-12 animate-pulse text-orange-400" />
        <p className="text-lg font-medium">
          {status === "loading" ? "AI 出題中…" : "AI 正在幫你想今天適合吃什麼…"}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-lg font-medium text-red-500 dark:text-red-400">{error}</p>
        <button onClick={loadQuestions} className={`mt-4 ${primaryButtonClass}`}>
          重新測試
        </button>
      </div>
    );
  }

  if (status === "result") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-bold text-gray-900 dark:text-gray-100">
            <Sparkles className="h-5 w-5 text-orange-500" />
            今天適合你的推薦
          </h2>
          <button onClick={loadQuestions} className={`flex items-center gap-1.5 ${secondaryButtonClass}`}>
            <RefreshCw className="h-4 w-4" />
            重新測試
          </button>
        </div>
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <button
              key={rec.product.id}
              onClick={() => onAddToCart(rec.product)}
              disabled={!rec.product.is_available}
              className={`flex w-full items-center justify-between gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft-md disabled:cursor-not-allowed disabled:opacity-50 ${cardClass}`}
            >
              <div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{rec.product.name}</div>
                {rec.reason && <p className={`mt-1 text-sm ${mutedTextClass}`}>{rec.reason}</p>}
              </div>
              <span className="flex-shrink-0 font-bold text-orange-600 dark:text-orange-400">
                NT$ {rec.product.price}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // status === "answering"
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-5 flex items-center gap-1.5 text-lg font-bold text-gray-900 dark:text-gray-100">
        <Sparkles className="h-5 w-5 text-orange-500" />
        今天想吃點什麼？先回答幾個小問題
      </h2>
      <div className="space-y-5">
        {questions.map((q, index) => (
          <div key={index} className={`${cardClass} p-4`}>
            <p className="mb-3 font-medium text-gray-800 dark:text-gray-200">{q.question}</p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  onClick={() => selectAnswer(index, option)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    answers[index] === option
                      ? "bg-orange-500 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={submitAnswers} disabled={!allAnswered} className={`mt-5 w-full ${primaryButtonClass}`}>
        看看今天適合吃什麼
      </button>
    </div>
  );
}
