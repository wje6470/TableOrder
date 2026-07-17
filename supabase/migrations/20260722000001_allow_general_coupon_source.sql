-- coupons.source 原本只允許 'manual'/'bulk'/'birthday'，新增一般優惠券方案（rule_type='general'）
-- 發出的優惠券用 source='general' 標記，所以要放寬這個檢查約束。

alter table coupons drop constraint if exists coupons_source_check;
alter table coupons add constraint coupons_source_check check (source in ('manual', 'bulk', 'birthday', 'general'));
