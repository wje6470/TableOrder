-- 在 order_items 記錄下單當下的商品名稱快照（跟 unit_price 一樣的理由：
-- 商品之後改名或下架，不該影響已經送出的訂單/報表顯示）。

alter table order_items add column if not exists product_name text;

update order_items oi
set product_name = p.name
from products p
where oi.product_id = p.id
  and oi.product_name is null;

alter table order_items alter column product_name set not null;
