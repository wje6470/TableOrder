from pydantic import BaseModel


class LinePayRequestResponse(BaseModel):
    payment_url: str
    transaction_id: str


class LinePayScanRequest(BaseModel):
    one_time_key: str


class PaymentStatusOut(BaseModel):
    provider: str
    status: str
