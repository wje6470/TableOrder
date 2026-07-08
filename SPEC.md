# 點餐系統規格書

版本：v1（MVP）
情境：單店家、內用、每桌固定平板點餐 + 店家自己一台平板做接單/管理

## 1. 使用情境總覽

- 每桌配一台固定平板，平板代表該桌。
- 顧客用手機號碼＋密碼登入自己的帳號才能點餐（整桌由一人登入代表全部人點餐）。
- 登入後可重複加點（同一桌多次送出訂單品項），直到結帳為止都算同一筆帳單。
- 顧客**不在平板上結帳**。用餐完畢後到櫃檯，店員在「店家平板」核對餐點與用餐情形，選擇付款方式（現金／其他）完成結帳。
- 店家只有一台平板，用分頁切換：**即時訂單看板 / 結帳 / 商品管理 / 報表分析**。不做自動開店打烊偵測，店家自行切換分頁。
- 新訂單／加點透過 Supabase Realtime 即時通知店家平板。
- 商品「上架／售完」共用同一個開關，店家一鍵切換，顧客端菜單即時反映（Realtime）。

## 2. 翻桌流程

1. 平板閒置時顯示「登入／註冊」畫面。
2. 顧客登入 → 系統自動在該桌建立一筆新的 `open` 狀態訂單（order）。
3. 顧客瀏覽菜單、加入購物車、送出（可重複多次，每次送出是一批 `order_items`）。
4. 顧客用餐完畢至櫃檯，店員在店家平板「結帳」分頁選擇該桌 → 顯示明細清單核對 → 選擇付款方式 → 完成結帳。
5. 結帳後該筆訂單轉為 `closed`，桌台狀態變回閒置，該桌平板自動登出，回到登入畫面等待下一組客人。

## 3. 資料庫設計（Supabase Postgres）

### customers（顧客帳號）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| phone | text unique | 登入帳號 |
| password_hash | text | |
| name | text | 可選 |
| points | int | 預留欄位，未來點數功能 |
| birthday | date | 預留欄位，未來生日禮功能 |
| created_at | timestamptz | |

### tables（桌台）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| table_number | text unique | |
| status | text | idle / occupied |
| created_at | timestamptz | |

### categories（商品分類）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| name | text | |
| sort_order | int | |

### products（商品）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| category_id | uuid FK | |
| name | text | |
| description | text | |
| price | numeric | |
| image_url | text | |
| is_available | boolean | 上架/售完共用開關 |
| created_at | timestamptz | |

### orders（一桌一次用餐 session／帳單）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| table_id | uuid FK | |
| customer_id | uuid FK | 登入代表該桌的顧客 |
| status | text | open / closed |
| opened_at | timestamptz | |
| closed_at | timestamptz | nullable |
| payment_method | text | cash / other，結帳時填入 |
| paid_amount | numeric | 結帳時填入 |
| total_amount | numeric | 結帳時計算彙總 |

### order_items（每次加點的品項）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK | |
| product_id | uuid FK | |
| quantity | int | |
| unit_price | numeric | 下單當下價格快照，避免之後改價影響歷史紀錄 |
| subtotal | numeric | quantity * unit_price |
| created_at | timestamptz | 用於判斷是「這次加點」的批次 |

## 4. 系統架構

- **前端**：React + Vite + TypeScript + Tailwind CSS
  - 顧客端路由（平板）：登入/註冊、菜單、購物車、歷史點餐紀錄
  - 店家端路由（平板）：即時訂單看板、結帳、商品管理、報表
  - 用 `@supabase/supabase-js` 直接訂閱 Realtime（orders / order_items 的 postgres_changes），店家看板即時更新，顧客菜單即時反映售完狀態
- **後端**：FastAPI
  - 自建 JWT 驗證（顧客與店家帳號皆由後端簽發 JWT，不依賴 Supabase Auth，因登入方式是手機號碼＋密碼／店家單一帳號）
  - SQLAlchemy (async) + asyncpg 直接連 Supabase 提供的 Postgres 連線字串
  - 商業邏輯：建立訂單、加點、結帳計算、銷售報表產生
  - 報表匯出：Excel（openpyxl）、PDF（reportlab）、CSV
- **資料庫**：Supabase Postgres（僅作為資料庫與 Realtime 服務，不使用 Supabase Auth）

## 5. MVP 功能清單

- [ ] 顧客註冊／登入（手機號碼＋密碼）
- [ ] 顧客菜單瀏覽（依分類，售完商品標示或隱藏）
- [ ] 購物車／送出加點
- [ ] 顧客歷史點餐紀錄查詢
- [ ] 店家單一帳號登入
- [ ] 店家即時訂單看板（Realtime 通知新加點）
- [ ] 店家結帳流程（核對明細、選付款方式、關閉訂單）
- [ ] 店家商品管理（新增／修改／刪除／上架↔售完）
- [ ] 分類管理
- [ ] 營收統計（日／月）
- [ ] 商品銷售排行
- [ ] 客單價分析
- [ ] Dashboard 圖表
- [ ] 報表匯出（Excel／CSV／PDF）

## 6. 後續功能（暫不實作，架構預留擴充）

- 會員點數、生日禮
- 呼叫服務生
- 促銷優惠券
- 線上金流
- 多店家 SaaS
- 店家多角色權限（店長／廚房／外場）
