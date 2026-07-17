-- 優惠券方案改成可以有多筆（生日／一般各自可新增多個），並且各自能切換生效中／停止中，
-- 「生效中」的方案才會被 cron 排程發送給符合資格的顧客。
-- 把原本「全店僅一條有效規則」的 birthday_coupon_rules 擴充成通用的 coupon_rules，
-- 用 rule_type 區分生日／一般，product_id 也放寬成可選（不一定要限定商品）。

alter table birthday_coupon_rules rename to coupon_rules;

alter table coupon_rules add column if not exists rule_type text not null default 'birthday';
alter table coupon_rules add constraint coupon_rules_rule_type_check check (rule_type in ('birthday', 'general'));
alter table coupon_rules alter column product_id drop not null;

-- 記錄每張優惠券是哪個方案發出的，讓分發時可以判斷「這個顧客已經領過這個方案了」避免重複發放。
alter table coupons add column if not exists rule_id uuid references coupon_rules(id) on delete set null;
create index if not exists idx_coupons_rule_id on coupons (rule_id);
