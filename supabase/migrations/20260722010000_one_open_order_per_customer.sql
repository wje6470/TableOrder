-- 同一個顧客帳號同時只能有一筆 open 訂單（不能同時在不同桌各開一筆未結帳的訂單）。
-- 跟 idx_orders_one_open_per_table 是同一種保護，只是保護的對象從「桌」換成「顧客」，
-- 讓 open_order 在併發情況下（例如同一帳號幾乎同時在兩台平板送出開桌請求）也能靠資料庫
-- 唯一索引擋下，而不是只靠應用層先查後寫的檢查。
create unique index if not exists idx_orders_one_open_per_customer
    on orders (customer_id)
    where status = 'open';
