-- 折價券功能：店家可以指定發放折價券（固定金額或百分比）給特定顧客，
-- 顧客可以選擇套用到目前開桌中的訂單，結帳時實際折抵訂單金額。

-- ========== coupons (店家發給顧客的折價券) ==========
create table if not exists coupons (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers(id) on delete cascade,
    order_id uuid references orders(id) on delete set null,
    title text,
    discount_type text not null check (discount_type in ('fixed', 'percentage')),
    discount_value numeric(10, 2) not null check (discount_value > 0),
    is_used boolean not null default false,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

alter table orders add column if not exists discount_amount numeric(10, 2) not null default 0;

create index if not exists idx_coupons_customer_id on coupons (customer_id);
create index if not exists idx_coupons_order_id on coupons (order_id);

alter table coupons enable row level security;
create policy "anon can read coupons" on coupons for select using (true);
