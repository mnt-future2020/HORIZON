"""
Centralized timezone helper — Asia/Kolkata (IST, UTC+05:30).
Import `now_ist` everywhere instead of `datetime.now(timezone.utc)`.
"""
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    """Current time in IST (Asia/Kolkata)."""
    return datetime.now(IST)


def today_ist() -> str:
    """Today's date string in IST (YYYY-MM-DD)."""
    return now_ist().strftime("%Y-%m-%d")


def parse_ist(date_str: str, time_str: str) -> datetime:
    """Parse a date + time string (e.g. '2026-02-27', '15:00') as IST-aware datetime."""
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M").replace(tzinfo=IST)
