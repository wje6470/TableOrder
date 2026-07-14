-- 廚房出單看板：顧客每次「送出點餐」對應一張出單卡片（kitchen_ticket），
-- 品項掛在 ticket 底下並記錄廚師是否已完成，供後廚看板分「待完成／已完成」呈現。

-- ========== kitchen_tickets (一次送出點餐 = 一張出單卡片) ==========
create table if not exists kitchen_tickets (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table order_items add column if not exists ticket_id uuid references kitchen_tickets(id) on delete cascade;
alter table order_items add column if not exists is_completed boolean not null default false;

create index if not exists idx_kitchen_tickets_order_id on kitchen_tickets (order_id);
create index if not exists idx_order_items_ticket_id on order_items (ticket_id);

alter table kitchen_tickets enable row level security;
create policy "anon can read kitchen_tickets" on kitchen_tickets for select using (true);

alter publication supabase_realtime add table kitchen_tickets;
