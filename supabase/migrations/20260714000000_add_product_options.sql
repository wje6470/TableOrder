-- 商品客製化選項（例如飲料的「甜度」「冰塊」單選、漢堡的「去配料」多選），
-- 選項可加價；下單當下的選擇會 snapshot 到 order_item_options，避免店家事後修改選項影響歷史訂單。

-- ========== product_option_groups (商品的選項群組，如「甜度」) ==========
create table if not exists product_option_groups (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    name text not null,
    selection_type text not null check (selection_type in ('single', 'multi')),
    is_required boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

-- ========== product_options (群組底下的選項，如「無糖」) ==========
create table if not exists product_options (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references product_option_groups(id) on delete cascade,
    name text not null,
    price_delta numeric(10, 2) not null default 0,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

-- ========== order_item_options (下單當下選擇的選項 snapshot) ==========
create table if not exists order_item_options (
    id uuid primary key default gen_random_uuid(),
    order_item_id uuid not null references order_items(id) on delete cascade,
    group_name text not null,
    option_name text not null,
    price_delta numeric(10, 2) not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_product_option_groups_product_id on product_option_groups (product_id);
create index if not exists idx_product_options_group_id on product_options (group_id);
create index if not exists idx_order_item_options_order_item_id on order_item_options (order_item_id);

alter table product_option_groups enable row level security;
alter table product_options enable row level security;
alter table order_item_options enable row level security;

create policy "anon can read product_option_groups" on product_option_groups for select using (true);
create policy "anon can read product_options" on product_options for select using (true);
create policy "anon can read order_item_options" on order_item_options for select using (true);
