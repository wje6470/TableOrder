-- 線上金流（LINE Pay / PayPal）需要「請款 -> 顧客付款 -> 平台 callback 確認」的非同步流程，
-- 跟現金結帳當下直接關單不同，所以用獨立的表記錄每次請款嘗試的狀態，等 callback 確認成功後才真正關單。

create table if not exists payment_transactions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    provider text not null,
    provider_transaction_id text,
    provider_order_id text not null,
    amount numeric(10, 2) not null,
    discount_amount numeric(10, 2) not null default 0,
    coupon_id uuid references coupons(id) on delete set null,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    confirmed_at timestamptz
);

create index if not exists idx_payment_transactions_order_id on payment_transactions (order_id);
create index if not exists idx_payment_transactions_provider_transaction_id on payment_transactions (provider_transaction_id);

alter table payment_transactions enable row level security;
create policy "anon can read payment_transactions" on payment_transactions for select using (true);
