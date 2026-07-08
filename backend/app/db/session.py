from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool：跑在 Vercel serverless function 上，每個 invocation 可能是全新的容器，
# 池住的連線在 invocation 之間可能已經被 Supabase pooler 關掉，重用會噴錯。
# 改成每個 request 都開新連線、用完即關，交給 Supabase 的 Session Pooler 做連線管理。
engine = create_async_engine(settings.database_url, echo=False, poolclass=NullPool)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
