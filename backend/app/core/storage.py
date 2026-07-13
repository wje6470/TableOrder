import httpx

from app.core.config import settings

PRODUCT_IMAGES_BUCKET = "product-images"
ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


async def upload_product_image(object_path: str, content: bytes, content_type: str) -> str:
    """上傳圖片到 Supabase Storage，回傳可公開存取的 URL。"""
    url = f"{settings.supabase_url}/storage/v1/object/{PRODUCT_IMAGES_BUCKET}/{object_path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": content_type,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, content=content, timeout=30)
    resp.raise_for_status()
    return f"{settings.supabase_url}/storage/v1/object/public/{PRODUCT_IMAGES_BUCKET}/{object_path}"
