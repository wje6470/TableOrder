-- 讓顧客平板可以訂閱 tables 資料表的變動：
-- 店員結帳後 table.status 會變回 'idle'，前端藉此偵測「這桌已結帳」並自動登出顧客，
-- 避免顧客忘記在平板上手動登出。

alter publication supabase_realtime add table tables;
