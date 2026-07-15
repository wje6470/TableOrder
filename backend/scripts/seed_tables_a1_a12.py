"""建立 A1~A12 桌號（已存在的桌號會跳過）。"""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.table import Table


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for i in range(1, 13):
            table_number = f"A{i}"
            existing = await db.scalar(select(Table).where(Table.table_number == table_number))
            if existing is not None:
                print(f"已存在，略過：{table_number}")
                continue
            db.add(Table(table_number=table_number))
            print(f"已建立：{table_number}")
        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
