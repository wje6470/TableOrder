import csv
import io
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_store
from app.db.session import get_db
from app.models.store_account import StoreAccount
from app.schemas.report import (
    AvgOrderValue,
    CategoryRanking,
    CouponStats,
    PaymentMethodBreakdown,
    ProductRanking,
    ProductRevenuePoint,
    RevenuePoint,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_store)])

# PDF 匯出用的中文字型：reportlab 內建的 CJK CID 字型（如 MSung-Light）字元對應是錯的，
# 會印出錯誤的中文字，所以改內嵌 Noto Sans TC（SIL OFL 授權，可自由嵌入），確保顯示正確。
PDF_CJK_FONT_NAME = "NotoSansTC"
_PDF_CJK_FONT_PATH = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "NotoSansTC-Regular.ttf"
_pdf_cjk_font_registered = False


def _ensure_pdf_cjk_font_registered() -> None:
    global _pdf_cjk_font_registered
    if _pdf_cjk_font_registered:
        return
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    pdfmetrics.registerFont(TTFont(PDF_CJK_FONT_NAME, str(_PDF_CJK_FONT_PATH)))
    _pdf_cjk_font_registered = True


@router.get("/revenue", response_model=list[RevenuePoint])
async def revenue(
    start_date: date,
    end_date: date,
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_revenue(db, start_date, end_date, period)


@router.get("/top-products", response_model=list[ProductRanking])
async def top_products(
    start_date: date,
    end_date: date,
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("quantity", pattern="^(quantity|revenue)$"),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_top_products(db, start_date, end_date, limit, sort_by)


@router.get("/avg-order-value", response_model=AvgOrderValue)
async def avg_order_value(start_date: date, end_date: date, db: AsyncSession = Depends(get_db)):
    return await report_service.get_avg_order_value(db, start_date, end_date)


@router.get("/payment-methods", response_model=list[PaymentMethodBreakdown])
async def payment_methods(start_date: date, end_date: date, db: AsyncSession = Depends(get_db)):
    return await report_service.get_payment_method_breakdown(db, start_date, end_date)


@router.get("/categories", response_model=list[CategoryRanking])
async def categories(start_date: date, end_date: date, db: AsyncSession = Depends(get_db)):
    return await report_service.get_category_ranking(db, start_date, end_date)


@router.get("/coupons", response_model=CouponStats)
async def coupons(start_date: date, end_date: date, db: AsyncSession = Depends(get_db)):
    return await report_service.get_coupon_stats(db, start_date, end_date)


@router.get("/products/{product_id}/revenue", response_model=list[ProductRevenuePoint])
async def product_revenue(
    product_id: uuid.UUID,
    start_date: date,
    end_date: date,
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_product_revenue_trend(db, product_id, start_date, end_date, period)


@router.get("/export")
async def export_report(
    start_date: date,
    end_date: date,
    format: str = Query("csv", pattern="^(csv|xlsx|pdf)$"),
    product_ids: list[uuid.UUID] | None = Query(None),
    payment_methods: list[str] | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    rows = await report_service.get_order_detail_rows(db, start_date, end_date, product_ids, payment_methods)
    filename = f"report_{start_date}_{end_date}.{format}"

    if format == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(
            buffer,
            fieldnames=["order_id", "closed_at", "product_name", "quantity", "unit_price", "subtotal", "payment_method"],
        )
        writer.writeheader()
        writer.writerows(rows)
        # 前面加 UTF-8 BOM：Excel（尤其是 Windows 版）沒有 BOM 時會用系統預設編碼（例如 Big5）
        # 猜測檔案編碼，中文就會變亂碼。有 BOM 才會正確判斷成 UTF-8。
        return StreamingResponse(
            iter(["﻿" + buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    if format == "xlsx":
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "銷售明細"
        headers = ["訂單編號", "結帳時間", "商品名稱", "數量", "單價", "小計", "付款方式"]
        ws.append(headers)
        for row in rows:
            ws.append(
                [
                    row["order_id"],
                    row["closed_at"],
                    row["product_name"],
                    row["quantity"],
                    float(row["unit_price"]),
                    float(row["subtotal"]),
                    row["payment_method"],
                ]
            )
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    if format == "pdf":
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

        _ensure_pdf_cjk_font_registered()
        font_name = PDF_CJK_FONT_NAME

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        headers = ["訂單編號", "結帳時間", "商品名稱", "數量", "單價", "小計", "付款方式"]
        data = [headers] + [
            [
                row["order_id"][:8],
                row["closed_at"],
                row["product_name"],
                row["quantity"],
                str(row["unit_price"]),
                str(row["subtotal"]),
                row["payment_method"],
            ]
            for row in rows
        ]
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTNAME", (0, 0), (-1, -1), font_name),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        doc.build([table])
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支援的格式")
