import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool：跑在 Vercel serverless function 上，每個 invocation 可能是全新的容器，
# 池住的連線在 invocation 之間可能已經被 Supabase pooler 關掉，重用會噴錯。
# 改成每個 request 都開新連線、用完即關，交給 Supabase 的 Session Pooler 做連線管理。
#
# 本機開發（uvicorn 常駐 process）不會有這個問題，用 NullPool 反而讓每個 request
# 都要重新跟 Supabase（雪梨區域）握手建線，實測一次要 4~6 秒；改用真正的連線池、
# 重複使用連線後，除了第一次請求，之後每次查詢只要 ~0.7 秒（純網路來回時間）。
# 用 Vercel 會自動注入的 VERCEL 環境變數判斷是不是跑在 serverless 上。
if os.environ.get("VERCEL"):
    engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
else:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_size=5,
        max_overflow=5,
        pool_recycle=1800,
    )
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
