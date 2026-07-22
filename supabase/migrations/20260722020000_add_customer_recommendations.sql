-- 快取「AI 個人化推薦」的結果，避免同一位顧客短時間內重複開頁就重複呼叫 Gemini。
-- 只有在顧客又有新的已結帳訂單之後，才需要重新產生推薦（用 generated_at 跟顧客
-- 最新一筆已結帳訂單的 closed_at 比較，應用層判斷是否要重新算，不在資料庫層處理）。
-- product_ids / reasons 用對應索引的兩個陣列存，而不是塞一個 JSON 字串進單一欄位。
create table if not exists customer_recommendations (
    customer_id uuid primary key references customers(id) on delete cascade,
    product_ids uuid[] not null,
    reasons text[] not null default '{}',
    generated_at timestamptz not null default now()
);
