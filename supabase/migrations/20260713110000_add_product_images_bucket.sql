-- 商品圖片用的 Storage bucket。公開讀取（顧客點餐頁直接用 URL 顯示圖片），
-- 寫入一律經由後端 API（用 service_role key，略過 storage RLS），前端不會直接寫入。
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
