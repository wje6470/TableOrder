# 點餐系統

單店家內用點餐系統。詳細規格見 [SPEC.md](./SPEC.md)。

- 前端：React + Vite + TypeScript + Tailwind CSS（`frontend/`）
- 後端：FastAPI（`backend/`）
- 資料庫／即時通知：Supabase（Postgres + Realtime）

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
- 線上金流：LINE Pay 已串接（測試用 Sandbox Channel，見 `backend/.env` 的 `LINE_PAY_*`），PayPal 按鈕已預留但尚未串接後端。
- 尚未實作：呼叫服務生、多店家 SaaS、店家多角色權限。
