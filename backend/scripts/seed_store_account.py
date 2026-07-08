"""建立/重設店家帳號密碼。

用法：
    python scripts/seed_store_account.py <username> <password>

需要先在 backend/ 目錄下建立 .env（參考 .env.example）並安裝好 requirements.txt。
"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.store_account import StoreAccount


async def main(username: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        account = await db.scalar(select(StoreAccount).where(StoreAccount.username == username))
        if account is None:
            account = StoreAccount(username=username, password_hash=hash_password(password))
            db.add(account)
            print(f"已建立新的店家帳號：{username}")
        else:
            account.password_hash = hash_password(password)
            print(f"已重設店家帳號密碼：{username}")
        await db.commit()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法：python scripts/seed_store_account.py <username> <password>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
