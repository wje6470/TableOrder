import json
import uuid
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.models.product import Product

GEMINI_MODEL = "gemini-3.5-flash"


async def generate_json(prompt: str) -> Any | None:
    """呼叫 Gemini、要求回傳 JSON，失敗（沒金鑰、網路、額度、格式不對）一律回傳 None，
    交給呼叫端 fall back，不讓整個請求因為 AI 服務不穩而失敗。
    """
    if not settings.gemini_api_key:
        return None
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return json.loads(response.text)
    except Exception:
        return None


def parse_product_picks(
    data: Any, menu_by_id: dict[uuid.UUID, Product], max_count: int
) -> list[tuple[uuid.UUID, str | None]]:
    """把 Gemini 回傳的 [{"product_id": ..., "reason": ...}] 過濾成只保留菜單裡真的存在的商品，
    避免模型自己編出不存在的商品 id。"""
    picks: list[tuple[uuid.UUID, str | None]] = []
    if not isinstance(data, list):
        return picks
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            product_id = uuid.UUID(str(item.get("product_id")))
        except (ValueError, AttributeError, TypeError):
            continue
        if product_id in menu_by_id:
            picks.append((product_id, item.get("reason")))
        if len(picks) >= max_count:
            break
    return picks
