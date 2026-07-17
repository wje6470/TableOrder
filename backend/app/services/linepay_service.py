import asyncio
import base64
import hashlib
import hmac
import json
import uuid

import httpx

from app.core.config import settings


class LinePayError(Exception):
    def __init__(self, return_code: str, return_message: str):
        self.return_code = return_code
        self.return_message = return_message
        super().__init__(f"LINE Pay 錯誤 {return_code}: {return_message}")


def _sign(uri: str, body: str, nonce: str) -> str:
    """LINE Pay v3 簽章：Base64(HMAC-SHA256(channelSecret, channelSecret + uri + body + nonce))。"""
    message = f"{settings.line_pay_channel_secret}{uri}{body}{nonce}"
    digest = hmac.new(settings.line_pay_channel_secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def _headers(uri: str, body: str) -> dict[str, str]:
    nonce = str(uuid.uuid4())
    return {
        "Content-Type": "application/json",
        "X-LINE-ChannelId": settings.line_pay_channel_id,
        "X-LINE-Authorization-Nonce": nonce,
        "X-LINE-Authorization": _sign(uri, body, nonce),
    }


async def _post(uri: str, payload: dict, timeout: float = 15) -> dict:
    # body 一定要跟簽章用的字串完全一致（byte for byte），所以先序列化成字串，
    # 簽章跟實際送出的 request body 都用同一份字串，不要各自 json.dumps 一次。
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    async with httpx.AsyncClient(base_url=settings.line_pay_api_base, timeout=timeout) as client:
        resp = await client.post(uri, content=body.encode("utf-8"), headers=_headers(uri, body))
    data = resp.json()
    if data.get("returnCode") != "0000":
        raise LinePayError(data.get("returnCode", "?"), data.get("returnMessage", "unknown error"))
    return data["info"]


async def _get(uri: str) -> dict:
    async with httpx.AsyncClient(base_url=settings.line_pay_api_base, timeout=15) as client:
        resp = await client.get(uri, headers=_headers(uri, ""))
    data = resp.json()
    if data.get("returnCode") != "0000":
        raise LinePayError(data.get("returnCode", "?"), data.get("returnMessage", "unknown error"))
    return data["info"]


async def request_payment(
    *, amount: int, order_id: str, product_name: str, confirm_url: str, cancel_url: str
) -> dict:
    """呼叫 LINE Pay Request API，取得付款頁網址跟 transactionId。"""
    payload = {
        "amount": amount,
        "currency": "TWD",
        "orderId": order_id,
        "packages": [
            {
                "id": "package-1",
                "amount": amount,
                "products": [{"name": product_name, "quantity": 1, "price": amount}],
            }
        ],
        "redirectUrls": {"confirmUrl": confirm_url, "cancelUrl": cancel_url},
    }
    return await _post("/v3/payments/request", payload)


async def confirm_payment(*, transaction_id: str, amount: int) -> dict:
    """顧客在 LINE Pay 頁面完成付款、導回 confirmUrl 後，呼叫 Confirm API 才算真的請款成功。"""
    payload = {"amount": amount, "currency": "TWD"}
    return await _post(f"/v3/payments/{transaction_id}/confirm", payload)


async def pay_with_one_time_key(*, amount: int, order_id: str, product_name: str, one_time_key: str) -> dict:
    """線下掃碼付款（Offline API v4）：店員掃到顧客 LINE Pay 付款碼解出來的字串就是 oneTimeKey，
    直接拿去請款，一次呼叫同步拿到成功或失敗，不像線上付款需要導回 confirm。
    LINE Pay 建議 read timeout 抓 20 秒左右，逾時要改呼叫 check API 確認實際結果，
    避免因為連線逾時誤判失敗、店員重掃又重複扣款一次。
    """
    payload = {
        "amount": amount,
        "currency": "TWD",
        "orderId": order_id,
        "productName": product_name,
        "oneTimeKey": one_time_key,
    }
    try:
        info = await _post("/v4/payments/oneTimeKeys/pay", payload, timeout=25)
    except httpx.TimeoutException:
        info = None
        # 逾時不代表付款失敗，可能只是回應比較慢——LINE Pay 官方建議改查狀態，
        # AUTH_READY 表示還在處理中，最多再等個幾次，真的查不到才視為失敗。
        for _ in range(5):
            await asyncio.sleep(2)
            info = await check_offline_payment_status(order_id)
            if info.get("status") == "AUTH_READY":
                info = None
                continue
            break
        if info is None:
            raise LinePayError("TIMEOUT", "付款狀態確認逾時，請跟顧客確認 LINE Pay 是否已扣款，必要時聯繫客服處理")

    status = info.get("status")
    if status is not None and status != "COMPLETE":
        raise LinePayError(status, f"付款未完成（狀態：{status}）")
    return info


async def check_offline_payment_status(order_id: str) -> dict:
    """查詢 oneTimeKeys/pay 送出的 orderId 實際付款狀態：info.status 為 AUTH_READY/COMPLETE/CANCEL/FAIL。"""
    return await _get(f"/v4/payments/orders/{order_id}/check")
