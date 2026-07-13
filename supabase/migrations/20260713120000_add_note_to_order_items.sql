-- 讓顧客點餐時可以對品項加上備註（例如「少冰」「不要香菜」）。

alter table order_items add column if not exists note text;
