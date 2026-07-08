import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_store
from app.db.session import get_db
from app.models.store_account import StoreAccount
from app.schemas.report import AvgOrderValue, ProductRanking, RevenuePoint
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_store)])


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
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_top_products(db, start_date, end_date, limit)


@router.get("/avg-order-value", response_model=AvgOrderValue)
async def avg_order_value(start_date: date, end_date: date, db: AsyncSession = Depends(get_db)):
    return await report_service.get_avg_order_value(db, start_date, end_date)


@router.get("/export")
async def export_report(
    start_date: date,
    end_date: date,
    format: str = Query("csv", pattern="^(csv|xlsx|pdf)$"),
    db: AsyncSession = Depends(get_db),
):
    rows = await report_service.get_order_detail_rows(db, start_date, end_date)
    filename = f"report_{start_date}_{end_date}.{format}"

    if format == "csv":
        buffer = io.StringIO()
        writer = csv.DictWriter(
            buffer,
            fieldnames=["order_id", "closed_at", "product_name", "quantity", "unit_price", "subtotal", "payment_method"],
        )
        writer.writeheader()
        writer.writerows(rows)
        return StreamingResponse(
            iter([buffer.getvalue()]),
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
        # 注意：reportlab 預設字型不含中文字型，商品名稱若含中文會顯示不出來，
        # 之後需要 registerFont 一個內嵌的 CJK 字型（例如 Noto Sans TC）才能正確顯示中文。
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        headers = ["Order", "Closed At", "Product", "Qty", "Unit Price", "Subtotal", "Payment"]
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
