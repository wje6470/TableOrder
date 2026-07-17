-- orders.payment_method 的檢查約束從建立系統以來只允許 'cash'/'other'，
-- 從沒更新過允許 'linepay'/'paypal'，導致這兩種付款方式結帳寫入資料庫時會被拒絕（500 錯誤）。
-- 這個問題原本應該在串接 LINE Pay 時就一併修正，這裡補上。

alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
    check (payment_method in ('cash', 'other', 'linepay', 'paypal'));
