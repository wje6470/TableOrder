-- 優惠券擴充：支援「限定商品」折抵、「有效期限」（節日券當日限定），
-- 以及生日月自動發放規則設定（由 Vercel Cron 每日排程呼叫後端發放）。

alter table coupons add column if not exists product_id uuid references products(id) on delete set null;
alter table coupons add column if not exists valid_until date;
alter table coupons add column if not exists source text not null default 'manual' check (source in ('manual', 'bulk', 'birthday'));

create index if not exists idx_coupons_product_id on coupons (product_id);

-- ========== birthday_coupon_rules (生日優惠規則，全店僅一條有效規則) ==========
create table if not exists birthday_coupon_rules (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    discount_type text not null check (discount_type in ('fixed', 'percentage')),
    discount_value numeric(10, 2) not null check (discount_value > 0),
    title text,
    is_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table birthday_coupon_rules enable row level security;
create policy "anon can read birthday_coupon_rules" on birthday_coupon_rules for select using (true);
