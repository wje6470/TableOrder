from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

# 單店家開在台灣，「今天」「本月」這類日期計算都要以台灣時間為準，不能用資料庫／伺服器
# 預設的 UTC——否則半夜的訂單（台灣時間已經是隔天）在報表跟優惠券到期判斷上會被誤判成前一天。
BUSINESS_TIMEZONE = ZoneInfo("Asia/Taipei")


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    frontend_origin: str = "http://localhost:5173"
    supabase_url: str
    supabase_service_role_key: str
    cron_secret: str = ""
    line_pay_channel_id: str = ""
    line_pay_channel_secret: str = ""
    line_pay_env: str = "sandbox"
    backend_base_url: str = "http://localhost:8000"
    gemini_api_key: str = ""

    # extra="ignore"：.env 裡可能會有還沒正式串接、只是先暫存的設定（例如 PayPal 相關變數），
    # 不希望這種還沒用到的欄位讓整個後端啟動失敗。
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def line_pay_api_base(self) -> str:
        return "https://api-pay.line.me" if self.line_pay_env == "production" else "https://sandbox-api-pay.line.me"

    @property
    def frontend_origins(self) -> list[str]:
        """localhost 和 127.0.0.1 對瀏覽器來說是不同的 CORS origin，開發時兩個都允許。"""
        origins = {self.frontend_origin}
        if "localhost" in self.frontend_origin:
            origins.add(self.frontend_origin.replace("localhost", "127.0.0.1"))
        elif "127.0.0.1" in self.frontend_origin:
            origins.add(self.frontend_origin.replace("127.0.0.1", "localhost"))
        return list(origins)


settings = Settings()
