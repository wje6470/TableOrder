import { CheckCircle2, Circle, StickyNote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { cardClass, mutedTextClass } from "../../lib/ui";
import { KitchenTicket, OrderItem } from "../../types";

interface TableInfo {
  id: string;
  table_number: string;
}

function minutesAgo(isoTime: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(isoTime).getTime()) / 60000));
}

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel("store-kitchen-display")
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  async function refresh() {
    const [ticketList, tableList] = await Promise.all([
      api.get<KitchenTicket[]>("/kitchen/tickets", "store"),
      api.get<TableInfo[]>("/tables"),
    ]);
    setTickets(ticketList);
    setTables(tableList);
  }

  function tableNumberOf(tableId: string) {
    return tables.find((t) => t.id === tableId)?.table_number ?? "?";
  }

  async function toggleItem(ticketId: string, item: OrderItem) {
    const nextCompleted = !item.is_completed;
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id !== ticketId
          ? ticket
          : {
              ...ticket,
              items: ticket.items.map((i) => (i.id === item.id ? { ...i, is_completed: nextCompleted } : i)),
            }
      )
    );
    try {
      await api.patch(`/kitchen/tickets/${ticketId}/items/${item.id}`, { is_completed: nextCompleted }, "store");
    } catch {
      void refresh();
    }
  }

  const { pending, done } = useMemo(() => {
    const isDone = (ticket: KitchenTicket) => ticket.items.length > 0 && ticket.items.every((i) => i.is_completed);
    const pendingList = tickets.filter((t) => !isDone(t)).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const doneList = tickets.filter(isDone).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { pending: pendingList, done: doneList };
  }, [tickets]);

  function TicketCard({ ticket }: { ticket: KitchenTicket }) {
    return (
      <div className={`${cardClass} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">桌號 {tableNumberOf(ticket.table_id)}</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">{minutesAgo(ticket.created_at, now)} 分鐘前</span>
        </div>
        <ul className="space-y-2">
          {ticket.items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => toggleItem(ticket.id, item)}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                  item.is_completed
                    ? "bg-gray-50 dark:bg-gray-900/40"
                    : "bg-orange-50/60 hover:bg-orange-100 dark:bg-orange-500/5 dark:hover:bg-orange-500/10"
                }`}
              >
                {item.is_completed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${
                      item.is_completed
                        ? "text-gray-400 line-through dark:text-gray-500"
                        : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {item.product_name} x{item.quantity}
                  </div>
                  {item.options.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.options.map((o) => o.option_name).join("、")}
                    </div>
                  )}
                  {item.note && (
                    <div className="mt-0.5 flex items-start gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                      <StickyNote className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>{item.note}</span>
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">廚房出單看板</h1>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-[2] space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">待完成（{pending.length}）</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pending.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
          {pending.length === 0 && <p className={mutedTextClass}>目前沒有待完成的出單</p>}
        </div>
        <div className="flex-[1] space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">已完成（{done.length}）</h2>
          <div className="grid grid-cols-1 gap-4">
            {done.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
          {done.length === 0 && <p className={mutedTextClass}>還沒有完成的出單</p>}
        </div>
      </div>
    </div>
  );
}
