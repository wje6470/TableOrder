-- 點餐系統資料庫 schema
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 貼上執行，或用 supabase CLI migration。

create extension if not exists "pgcrypto";

-- ========== customers ==========
create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    phone text unique not null,
    password_hash text not null,
    name text,
    points integer not null default 0,
    birthday date,
    created_at timestamptz not null default now()
);

-- ========== store_accounts (店家單一帳號) ==========
create table if not exists store_accounts (
    id uuid primary key default gen_random_uuid(),
    username text unique not null,
    password_hash text not null,
    created_at timestamptz not null default now()
);

-- ========== tables ==========
create table if not exists tables (
    id uuid primary key default gen_random_uuid(),
    table_number text unique not null,
    status text not null default 'idle' check (status in ('idle', 'occupied')),
    created_at timestamptz not null default now()
);

-- ========== categories ==========
create table if not exists categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

-- ========== products ==========
create table if not exists products (
    id uuid primary key default gen_random_uuid(),
    category_id uuid references categories(id) on delete set null,
    name text not null,
    description text,
    price numeric(10, 2) not null check (price >= 0),
    image_url text,
    is_available boolean not null default true,
    created_at timestamptz not null default now()
);

-- ========== orders (一桌一次用餐 session / 帳單) ==========
create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    table_id uuid not null references tables(id),
    customer_id uuid not null references customers(id),
    status text not null default 'open' check (status in ('open', 'closed')),
    opened_at timestamptz not null default now(),
    closed_at timestamptz,
    payment_method text check (payment_method in ('cash', 'other')),
    paid_amount numeric(10, 2),
    total_amount numeric(10, 2) not null default 0
);

-- 同一桌同時只能有一筆 open 訂單
create unique index if not exists idx_orders_one_open_per_table
    on orders (table_id)
    where status = 'open';

-- ========== order_items (每次加點的品項) ==========
create table if not exists order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    product_id uuid not null references products(id),
    quantity integer not null check (quantity > 0),
    unit_price numeric(10, 2) not null,
    subtotal numeric(10, 2) not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on order_items (order_id);
create index if not exists idx_orders_table_id on orders (table_id);
create index if not exists idx_orders_customer_id on orders (customer_id);
create index if not exists idx_orders_status on orders (status);
create index if not exists idx_products_category_id on products (category_id);

-- ========== Realtime ==========
-- 讓店家看板與顧客菜單可以訂閱這些資料表的變動
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table products;

-- ========== Row Level Security ==========
-- 後端 FastAPI 一律用 service_role key 存取（略過 RLS）。
-- 前端只用 anon key 做「唯讀訂閱」，因此開 RLS 但只允許 SELECT，寫入一律經過後端 API。
alter table customers enable row level security;
alter table store_accounts enable row level security;
alter table tables enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "anon can read products" on products for select using (true);
create policy "anon can read categories" on categories for select using (true);
create policy "anon can read tables" on tables for select using (true);
create policy "anon can read orders" on orders for select using (true);
create policy "anon can read order_items" on order_items for select using (true);
-- customers、store_accounts 不開放 anon 讀取（含密碼雜湊），一律經後端 API 存取
