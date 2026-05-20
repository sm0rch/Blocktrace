from __future__ import annotations

import datetime as dt
import math
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT_XLSX = Path(r"C:\Users\ADMIN\Downloads\BlockTrace_Virtual_DB.xlsx")
OUTPUT_SQL = ROOT / "prisma" / "seed" / "import_blocktrace_virtual_db.sql"

TABLE_ORDER = [
    "PRODUCER",
    "CARRIER",
    "CUSTOMER",
    "BATCH_NFT",
    "QR_CODE",
    "TRANSACTION",
    "BILLING_DETAIL",
    "SHIPMENT_LOG",
    "ISSUE_REPORT",
    "RESOLUTION",
    "QUERY_HISTORY",
    "REPUTATION_LOG",
]

PRIMARY_KEYS = {
    "PRODUCER": "producer_id",
    "CARRIER": "carrier_id",
    "CUSTOMER": "customer_id",
    "BATCH_NFT": "tokenId",
    "QR_CODE": "qr_id",
    "TRANSACTION": "tx_id",
    "BILLING_DETAIL": "billing_id",
    "SHIPMENT_LOG": "log_id",
    "ISSUE_REPORT": "issue_id",
    "RESOLUTION": "resolution_id",
    "QUERY_HISTORY": "query_id",
    "REPUTATION_LOG": "log_id",
}


def is_null(value: object) -> bool:
    try:
        return bool(pd.isna(value))
    except Exception:
        return False


def sql_value(value: object) -> str:
    if is_null(value):
        return "NULL"
    if isinstance(value, pd.Timestamp):
        return "N'" + value.strftime("%Y-%m-%d %H:%M:%S").replace("'", "''") + "'"
    if isinstance(value, dt.datetime):
        return "N'" + value.strftime("%Y-%m-%d %H:%M:%S").replace("'", "''") + "'"
    if isinstance(value, dt.date):
        return "N'" + value.strftime("%Y-%m-%d").replace("'", "''") + "'"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return "NULL"
        return str(value)

    text = str(value)
    if text in {"NaT", "nan", "NaN"}:
        return "NULL"
    return "N'" + text.replace("'", "''") + "'"


def main() -> None:
    OUTPUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = [
        "-- BlockTrace virtual data seed generated from BlockTrace_Virtual_DB.xlsx",
        "-- Run after applying prisma/migrations/20260518050131_blocktrace_offchain_v2.",
        "-- The script is insert-only/idempotent by primary key; existing rows are left unchanged.",
        "SET NOCOUNT ON;",
        "BEGIN TRY",
        "BEGIN TRAN;",
    ]

    for table in TABLE_ORDER:
        frame = pd.read_excel(INPUT_XLSX, sheet_name=table)
        frame = frame.where(pd.notna(frame), None)
        key = PRIMARY_KEYS[table]
        columns = [str(column) for column in frame.columns]
        column_sql = ", ".join(f"[{column}]" for column in columns)

        lines.extend(["", f"-- {table}"])
        for _, row in frame.iterrows():
            key_value = sql_value(row[key])
            values = ", ".join(sql_value(row[column]) for column in columns)
            lines.append(f"IF NOT EXISTS (SELECT 1 FROM [dbo].[{table}] WHERE [{key}] = {key_value})")
            lines.append(f"    INSERT INTO [dbo].[{table}] ({column_sql}) VALUES ({values});")

    lines.extend(
        [
            "COMMIT TRAN;",
            "END TRY",
            "BEGIN CATCH",
            "    IF @@TRANCOUNT > 0 ROLLBACK TRAN;",
            "    THROW;",
            "END CATCH;",
        ]
    )

    OUTPUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUTPUT_SQL)


if __name__ == "__main__":
    main()
