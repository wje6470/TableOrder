# 點餐系統

單店家內用點餐系統。原始 MVP 規格見 [SPEC.md](./SPEC.md)（部分項目已超出該文件範圍，實際功能以下方「功能總覽」為準）。

- 前端：React + Vite + TypeScript + Tailwind CSS（`frontend/`）
- 後端：FastAPI（`backend/`）
- 資料庫／即時通知：Supabase（Postgres + Realtime）

## 功能總覽

### 顧客端平板（`/order`）

- 首次開啟設定桌號（單一平板固定代表一桌，設定一次即可）
- 手機號碼＋密碼登入／註冊（可選填姓名、生日 — 生日用於生日優惠券自動發放）
- 菜單瀏覽：依分類顯示、商品圖片、售完狀態即時反映（Realtime，店家一鍵切換上架／售完）
- 點餐客製化選項（例如加料、去冰、辣度等，依商品設定）
- 購物車、加點、可重複送出（同一桌多次送出都算同一筆帳單，直到結帳）
- 「本次消費」清單：即時顯示目前這桌小計、已套用優惠券折抵金額
- 優惠券自動套用（符合資格的生日券／一般券，結帳金額自動折抵）
- **AI 智慧推薦**（串接 Google Gemini API，見 `backend/.env` 的 `GEMINI_API_KEY`）：
  - 為你推薦：根據這位顧客過去已結帳訂單的點餐紀錄，AI 從目前上架中的菜單挑選最多 3 樣可能喜歡的品項並附推薦理由；沒有點餐紀錄的新顧客改顯示全店熱門商品。結果會快取，直到這位顧客有新的已結帳訂單才會重新產生，避免同一天內重複開頁就重複呼叫 AI
  - AI 今日推薦：分類頁籤最右側新增的頁籤，AI 即時出 5 題跟今天天氣／心情相關的選擇題（每次題目都不同），顧客答完後由 AI 從目前菜單挑選最多 3 樣適合的品項並附理由，點選即可加入購物車，也可按「重新測試」重新抽一組題目
  - 兩者都限制 AI 只能從目前真的上架中的菜單裡挑選，不會推薦不存在或已下架的商品；AI 服務逾時、額度用盡或未設定金鑰時，會自動改顯示熱門商品，不影響正常點餐
- 點餐紀錄查詢（含空狀態提示、卡片可摺疊）
- 淺色／深色主題切換
- 響應式版面（手機／平板／桌面皆可使用）
- 店員完成結帳（現金／LINE Pay／PayPal 任一方式）後，該桌平板自動登出，避免帳號被下一組客人看到

### 店家後台平板（`/store`）

單一店家帳號登入，共六個分頁：

- **即時看板**：Realtime 顯示各桌訂單狀態，只顯示有實際消費（金額 > 0）的桌次
- **廚房出單**：出餐用看板，即時顯示待處理品項
- **結帳**：核對桌次明細，選擇付款方式完成結帳
  - 現金：直接記錄
  - LINE Pay：店員用平板鏡頭掃描顧客的付款條碼，透過 LINE Pay Offline API 同步請款（測試用 Sandbox Channel，見 `backend/.env` 的 `LINE_PAY_*`）
  - PayPal：走實體無線刷卡機獨立收款（刷卡機跟平板軟體沒有串接），店員在刷卡機上完成收款後按「確認已刷卡收款」直接記錄，不呼叫 PayPal API
  - 同樣只列出有實際消費（金額 > 0）的桌次
- **優惠券管理**：
  - 可新增／刪除多筆優惠券方案，分「生日禮」與「一般優惠」兩種類型
  - 每筆方案可獨立切換「生效中／已停止」，只有生效中才會發送給符合資格的顧客
  - 方案一啟用（或每日排程偵測到當天生日的顧客）會自動發放給符合資格的顧客
  - 百分比折扣輸入框旁會顯示「% off」提示，避免誤輸入成金額
- **商品管理**：新增／修改／刪除商品與分類、上架↔售完切換、客製化選項設定
- **報表分析**：營收統計（日／月）、商品銷售排行、客單價分析、圖表，可匯出 Excel／CSV／PDF（含中文字型，匯出不會亂碼）

## 事前準備

1. 安裝 [Node.js](https://nodejs.org/)（LTS 版本即可，含 npm）
2. 安裝 [Python 3.11+](https://www.python.org/downloads/)
3. 註冊 [Supabase](https://supabase.com/) 帳號並建立一個新專案

## 電腦重灌 / 換新環境後如何還原

`.env` 檔案不在 git 裡（`.gitignore` 排除），所以 `git clone` 下來不會自動帶著跑。還原步驟：

1. `git clone` 這個 repo。
2. 把你自己備份的 `backend/.env` 和 `frontend/.env` 放回對應資料夾（Supabase 專案本身不用重建，這兩個檔案裡的連線字串、金鑰都還能用）。
3. 交給 Claude Code 設置環境時，只要說類似「電腦重灌了，剛從 GitHub clone 下來、.env 也放回去了，幫我確認環境可以正常運作」就好，不用列細節。原因：
   - Claude 對這個專案有跨對話的記憶，包含這台機器過去遇過的環境問題（例如全新 Windows 預設沒裝 Node.js／Python，或是 `asyncpg` 在較新版 Python 上要另外處理），會自動檢查、重裝缺的工具。
   - 它也知道要怎麼啟動前後端、建測試桌號/帳號、用瀏覽器實際操作驗證，不需要你手動照著下面的步驟做一遍。
4. 如果换成別的機器、或記憶對不上實際狀況（例如工具版本不同），Claude 會重新診斷；這種情況下才需要照本文件下面「事前準備」開始的完整步驟操作，或直接把錯誤訊息貼給它看。

> 提醒：`.env` 目前只在你自己手上，建議另外備份一份（例如密碼管理工具或私人雲端硬碟），重灌電腦不會遺失。

## 1. 設定 Supabase

Schema 用 [Supabase CLI migration](./supabase/migrations/) 管理（`supabase/migrations/20260708000000_initial_schema.sql`），不用手動貼 SQL Editor。這台機器還沒裝 Supabase CLI（沒有支援的 winget 套件），改用 `npx supabase` 免安裝直接執行。

1. 在 [supabase.com](https://supabase.com/) 建立一個新專案，記下 **Project Reference ID**（Project Settings -> General）與**資料庫密碼**（建立專案時設定的那組）。
2. 登入 CLI（會開瀏覽器授權）：
   ```
   npx supabase login
   ```
3. 連結到你的雲端專案並套用 migration：
   ```
   npx supabase link --project-ref <YOUR_PROJECT_REF>
   npx supabase db push
   ```
4. 到 Project Settings -> Database -> Connection string，選 **Session pooler**（不要用直連的 `db.<ref>.supabase.co`，那個位址只有 IPv6，多數本地網路環境連不上），複製字串填到後端 `.env` 的 `DATABASE_URL`（把開頭 `postgresql://` 換成 `postgresql+asyncpg://`，密碼中的 `@` 等特殊字元要 URL encode）。
5. 到 Project Settings -> API，複製 `Project URL` 與 `anon public` key，稍後用在前端 `.env`。

之後要修改資料表結構，用 `npx supabase migration new <名稱>` 建新的 migration 檔，再 `npx supabase db push` 套用，不要直接改已經 push 過的舊檔案。

## 2. 啟動後端（FastAPI）

```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell 用 .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # 再編輯 .env 填入 DATABASE_URL 等設定
```

建立店家帳號（單一帳號，密碼可自行設定）：

```
python scripts/seed_store_account.py store_owner your_password
```

啟動開發伺服器：

```
uvicorn app.main:app --reload
```

API 預設在 http://localhost:8000，可到 http://localhost:8000/docs 看自動產生的 API 文件。

## 3. 啟動前端（React）

```
cd frontend
npm install
copy .env.example .env          # 再編輯 .env 填入 Supabase URL/anon key
npm run dev
```

前端預設在 http://localhost:5173。

- `/` 開發用首頁，可分別進入顧客端與店家端（正式環境建議每台平板直接記住各自要開的網址）
- `/order` 顧客點餐平板：第一次開啟需輸入桌號（僅需設定一次），之後顯示登入／註冊畫面
- `/store` 店家後台平板：登入後可切換「即時看板／結帳／商品管理／報表分析」

## 開發前記得先建立桌號與商品分類

目前後台介面還沒有「新增桌台」的畫面，MVP 階段請直接呼叫 API 建立（之後可以再補後台介面）：

```
curl -X POST http://localhost:8000/tables \
  -H "Authorization: Bearer <store_token>" \
  -H "Content-Type: application/json" \
  -d "{\"table_number\": \"A1\"}"
```

`store_token` 可從 `POST /auth/store/login` 取得。

## 已知限制

- 店家後台還沒有「新增桌台」的介面，需直接呼叫 API。
- LINE Pay 目前接的是測試用 Sandbox Channel，正式上線需換成正式 Channel 並更新 `.env`。
- 尚未實作：呼叫服務生、多店家 SaaS、店家多角色權限。
