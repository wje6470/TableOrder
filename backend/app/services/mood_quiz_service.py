from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.schemas.mood_quiz import MoodQuizAnswer, MoodQuizQuestion
from app.schemas.product import ProductOut
from app.schemas.recommendation import RecommendedProductOut
from app.services.gemini_client import generate_json, parse_product_picks
from app.services.recommendation_service import get_fallback_products, to_popular_out

MAX_QUIZ_RECOMMENDATIONS = 3

DEFAULT_QUESTIONS = [
    MoodQuizQuestion(question="今天感覺熱不熱？", options=["很熱", "普通", "有點冷"]),
    MoodQuizQuestion(question="今天有沒有下雨？", options=["有下雨", "沒下雨"]),
    MoodQuizQuestion(question="現在肚子餓的程度？", options=["非常餓", "普通", "只想吃點小東西"]),
    MoodQuizQuestion(question="想吃清淡還是重口味？", options=["清淡", "重口味", "都可以"]),
    MoodQuizQuestion(question="想喝點什麼？", options=["冰的飲料", "熱飲", "不用飲料"]),
]


async def generate_quiz_questions() -> list[MoodQuizQuestion]:
    """出 5 題跟今天天氣／心情有關的簡短選擇題，答完之後用來推薦適合今天吃的餐點。
    Gemini 沒設定金鑰或呼叫失敗時，回傳一組預先寫好的預設題目，不會讓整個測驗開不了。
    """
    prompt = (
        "請設計 5 題簡短有趣的今日天氣／心情選擇題，用來幫忙推薦待會要點的餐點"
        "（例如：今天會不會下雨、今天熱不熱、現在多餓、想吃清淡還是重口味等），"
        "每題可以不一樣，發揮創意。每題附 2 到 4 個簡短選項。\n"
        '用 JSON 陣列格式回覆，每個元素是 {"question": "題目", "options": ["選項1", "選項2", ...]}，'
        "不要有其他文字。"
    )
    data = await generate_json(prompt)
    if not isinstance(data, list):
        return DEFAULT_QUESTIONS

    questions = []
    for item in data:
        if not isinstance(item, dict):
            continue
        question = item.get("question")
        options = item.get("options")
        if isinstance(question, str) and isinstance(options, list) and options:
            questions.append(MoodQuizQuestion(question=question, options=[str(o) for o in options]))
        if len(questions) >= 5:
            break

    return questions if questions else DEFAULT_QUESTIONS


async def get_quiz_recommendations(
    db: AsyncSession, answers: list[MoodQuizAnswer]
) -> list[RecommendedProductOut]:
    menu = list((await db.scalars(select(Product).where(Product.is_available.is_(True)))).all())
    menu_by_id = {p.id: p for p in menu}

    if not answers or not menu:
        return to_popular_out(await get_fallback_products(db))

    answer_lines = "\n".join(f"- {a.question} {a.answer}" for a in answers)
    menu_lines = "\n".join(f"- id={p.id} 名稱={p.name} 價格={p.price}" for p in menu)
    prompt = (
        "這位顧客剛剛做了一個「今日推薦」小測驗，回答如下：\n"
        f"{answer_lines}\n\n"
        "目前上架中的完整菜單如下：\n"
        f"{menu_lines}\n\n"
        "請根據這些回答（今天的天氣、心情、飢餓程度、口味偏好等），從上面「目前上架中的完整菜單」裡"
        "挑選最多 3 樣最適合他今天狀態的商品。只能挑選菜單裡列出的 id，不可以自己編造不存在的商品。\n"
        '用 JSON 陣列格式回覆，每個元素是 {"product_id": "<菜單裡的 id>", "reason": "一句話中文推薦理由"}，'
        "不要有其他文字。"
    )
    picks = parse_product_picks(await generate_json(prompt), menu_by_id, MAX_QUIZ_RECOMMENDATIONS)

    if not picks:
        return to_popular_out(await get_fallback_products(db))

    return [
        RecommendedProductOut(product=ProductOut.model_validate(menu_by_id[pid]), reason=reason or None, source="quiz")
        for pid, reason in picks
    ]
