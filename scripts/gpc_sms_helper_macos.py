#!/usr/bin/env python3
"""Local macOS SMS OTP helper for GPC GoPay flows.

Run this on the Mac that receives forwarded iPhone SMS messages. The helper
reads a copy of the macOS Messages database and exposes the latest matching OTP
on a localhost HTTP endpoint for the Chrome extension.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = 18767
DEFAULT_DB = "~/Library/Messages/chat.db"
MAC_ABSOLUTE_EPOCH = dt.datetime(2001, 1, 1, tzinfo=dt.timezone.utc)

OTP_PATTERNS = (
    re.compile(r"(?i)\bOTP\s*[:：]?\s*([0-9]{4,8})\b"),
    re.compile(r"#([0-9]{4,8})\b"),
    re.compile(r"(?<!\d)([0-9]{6})(?!\d)"),
)
KEYWORDS = ("gojek", "gopay", "openai llc", "openai")

STATE_LOCK = threading.Lock()
STATE = {
    "started_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    "db_path": "",
    "last_scan_at": "",
    "last_error": "",
    "last_rowid": 0,
    "last_otp": None,
    "otps": [],
}


def is_macos() -> bool:
    override = os.environ.get("GPC_SMS_HELPER_ALLOW_NON_MAC", "").strip().lower()
    return sys.platform == "darwin" or override in {"1", "true", "yes"}


def require_macos() -> None:
    if not is_macos():
        raise RuntimeError(
            "GPC local SMS Helper only supports macOS: it needs to read ~/Library/Messages/chat.db. "
            "Make sure the iPhone receiving the verification code has SMS forwarding enabled, "
            "and that the messages are visible in the Mac Messages app."
        )


def extract_gopay_otp(text: str, require_keywords: bool = True) -> Optional[str]:
    raw = text or ""
    lowered = raw.lower()
    if require_keywords and not any(keyword in lowered for keyword in KEYWORDS):
        return None
    for pattern in OTP_PATTERNS:
        match = pattern.search(raw)
        if match:
            return match.group(1)
    return None


def normalize_phone_key(value: object) -> str:
    digits = re.sub(r"\D+", "", str(value or ""))
    return f"+{digits}" if digits else ""


def mac_message_time_to_datetime(value: int | float | None) -> dt.datetime:
    if not value:
        return dt.datetime.now(dt.timezone.utc)
    seconds = float(value)
    if seconds > 10_000_000_000:
        seconds = seconds / 1_000_000_000
    return MAC_ABSOLUTE_EPOCH + dt.timedelta(seconds=seconds)


def update_state(**updates: object) -> None:
    with STATE_LOCK:
        STATE.update(updates)


def get_state() -> dict:
    with STATE_LOCK:
        return dict(STATE)


def copy_messages_db(db_path: Path) -> Path:
    if not db_path.exists():
        raise FileNotFoundError(f"Messages database not found: {db_path}")
    tmpdir = Path(tempfile.mkdtemp(prefix="gpc_messages_"))
    copied = tmpdir / "chat.db"
    shutil.copy2(db_path, copied)
    wal = db_path.with_name(db_path.name + "-wal")
    shm = db_path.with_name(db_path.name + "-shm")
    if wal.exists():
        shutil.copy2(wal, copied.with_name("chat.db-wal"))
    if shm.exists():
        shutil.copy2(shm, copied.with_name("chat.db-shm"))
    return copied


def read_recent_messages(db_path: Path, after_rowid: int = 0, limit: int = 80) -> list[dict]:
    copied = copy_messages_db(db_path)
    try:
        conn = sqlite3.connect(str(copied))
        conn.row_factory = sqlite3.Row
        params = (max(0, int(after_rowid or 0)), max(1, int(limit or 80)))
        try:
            rows = conn.execute(
                """
                SELECT
                  message.ROWID AS rowid,
                  message.guid AS guid,
                  message.text AS text,
                  message.date AS date,
                  message.service AS service,
                  message.destination_caller_id AS destination_caller_id,
                  message.account AS account,
                  handle.id AS handle,
                  chat.last_addressed_handle AS last_addressed_handle,
                  chat.account_login AS account_login
                FROM message
                LEFT JOIN handle ON message.handle_id = handle.ROWID
                LEFT JOIN chat_message_join ON chat_message_join.message_id = message.ROWID
                LEFT JOIN chat ON chat.ROWID = chat_message_join.chat_id
                WHERE message.ROWID > ?
                  AND message.text IS NOT NULL
                ORDER BY message.ROWID DESC
                LIMIT ?
                """,
                params,
            ).fetchall()
        except sqlite3.OperationalError:
            rows = conn.execute(
                """
                SELECT
                  message.ROWID AS rowid,
                  message.guid AS guid,
                  message.text AS text,
                  message.date AS date,
                  message.service AS service,
                  message.account AS account,
                  handle.id AS handle
                FROM message
                LEFT JOIN handle ON message.handle_id = handle.ROWID
                WHERE message.ROWID > ?
                  AND message.text IS NOT NULL
                ORDER BY message.ROWID DESC
                LIMIT ?
                """,
                params,
            ).fetchall()
        return [dict(row) for row in rows]
    finally:
        try:
            conn.close()  # type: ignore[name-defined]
        except Exception:
            pass
        shutil.rmtree(copied.parent, ignore_errors=True)


def get_record_phone(row: dict) -> str:
    for key in ("destination_caller_id", "last_addressed_handle", "account_login", "account"):
        phone = normalize_phone_key(row.get(key))
        if phone:
            return phone
    return ""


def make_otp_record(row: dict, otp: str) -> dict:
    received_at = mac_message_time_to_datetime(row.get("date")).isoformat()
    phone_e164 = get_record_phone(row)
    return {
        "otp": otp,
        "code": otp,
        "message_id": str(row.get("guid") or row.get("rowid") or ""),
        "rowid": int(row.get("rowid") or 0),
        "sender": str(row.get("handle") or ""),
        "service": str(row.get("service") or ""),
        "account_phone": phone_e164,
        "phone_e164": phone_e164,
        "received_at": received_at,
        "message_text": str(row.get("text") or ""),
    }


def append_otp(record: dict, max_records: int = 30) -> None:
    with STATE_LOCK:
        records = [item for item in STATE.get("otps", []) if item.get("message_id") != record.get("message_id")]
        records.insert(0, record)
        STATE["otps"] = records[:max_records]
        STATE["last_otp"] = record
        STATE["last_rowid"] = max(int(STATE.get("last_rowid") or 0), int(record.get("rowid") or 0))


def parse_timestamp_ms(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        numeric = float(value)
    else:
        raw = str(value).strip()
        if not raw:
            return 0
        try:
            numeric = float(raw)
        except ValueError:
            try:
                parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=dt.timezone.utc)
                return int(parsed.timestamp() * 1000)
            except ValueError:
                return 0
    if numeric <= 0:
        return 0
    if numeric < 100_000_000_000:
        numeric *= 1000
    return int(numeric)


def record_matches_phone(record: dict, phone: str = "") -> bool:
    wanted = normalize_phone_key(phone)
    if not wanted:
        return True
    return normalize_phone_key(record.get("phone_e164") or record.get("account_phone")) == wanted


def select_otp_record(state: dict, after_ms: int = 0, phone: str = "") -> Optional[dict]:
    records = state.get("otps")
    if not isinstance(records, list):
        records = []
    if after_ms > 0:
        for record in records:
            if (
                isinstance(record, dict)
                and record_matches_phone(record, phone)
                and parse_timestamp_ms(record.get("received_at")) >= after_ms
            ):
                return record
        return None
    record = state.get("last_otp") or None
    if isinstance(record, dict) and record_matches_phone(record, phone):
        return record
    for record in records:
        if isinstance(record, dict) and record_matches_phone(record, phone):
            return record
    return None


def consume_otp_record(phone: str = "", record: Optional[dict] = None) -> None:
    wanted = normalize_phone_key(phone)
    consumed_message_id = str((record or {}).get("message_id") or "").strip()
    consumed_rowid = int((record or {}).get("rowid") or 0)

    def is_consumed_record(item: object) -> bool:
        if not isinstance(item, dict):
            return False
        if consumed_message_id and str(item.get("message_id") or "").strip() == consumed_message_id:
            return True
        if consumed_rowid and int(item.get("rowid") or 0) == consumed_rowid:
            return True
        return False

    def is_same_record(left: object, right: object) -> bool:
        if not isinstance(left, dict) or not isinstance(right, dict):
            return False
        left_message_id = str(left.get("message_id") or "").strip()
        right_message_id = str(right.get("message_id") or "").strip()
        if left_message_id and right_message_id and left_message_id == right_message_id:
            return True
        left_rowid = int(left.get("rowid") or 0)
        right_rowid = int(right.get("rowid") or 0)
        if left_rowid > 0 and right_rowid > 0 and left_rowid == right_rowid:
            return True
        return left == right

    with STATE_LOCK:
        records = STATE.get("otps")
        if not isinstance(records, list):
            records = []

        if consumed_message_id or consumed_rowid:
            next_records = [item for item in records if isinstance(item, dict) and not is_consumed_record(item)]
        elif wanted:
            removed_once = False
            next_records = []
            for item in records:
                if not isinstance(item, dict):
                    continue
                if not removed_once and record_matches_phone(item, wanted):
                    removed_once = True
                    continue
                next_records.append(item)
        else:
            next_records = []

        STATE["otps"] = next_records
        last_otp = STATE.get("last_otp")
        if isinstance(last_otp, dict) and not any(is_same_record(last_otp, item) for item in STATE["otps"]):
            STATE["last_otp"] = STATE["otps"][0] if STATE["otps"] else None


def scan_once(db_path: Path, require_keywords: bool = True) -> None:
    state = get_state()
    after_rowid = int(state.get("last_rowid") or 0)
    rows = read_recent_messages(db_path, after_rowid=after_rowid)
    max_rowid = after_rowid
    for row in reversed(rows):
        max_rowid = max(max_rowid, int(row.get("rowid") or 0))
        otp = extract_gopay_otp(row.get("text") or "", require_keywords=require_keywords)
        if otp:
            record = make_otp_record(row, otp)
            append_otp(record)
            print(f"captured OTP {otp} from message {record['message_id']} at {record['received_at']}", flush=True)
    update_state(last_rowid=max_rowid, last_scan_at=dt.datetime.now(dt.timezone.utc).isoformat(), last_error="")


def scan_loop(db_path: Path, interval_seconds: float, require_keywords: bool) -> None:
    update_state(db_path=str(db_path))
    while True:
        try:
            scan_once(db_path, require_keywords=require_keywords)
        except Exception as exc:
            update_state(last_error=str(exc), last_scan_at=dt.datetime.now(dt.timezone.utc).isoformat())
            print(f"scan error: {exc}", file=sys.stderr, flush=True)
        time.sleep(max(0.5, float(interval_seconds or 2)))


def write_json(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class HelperHandler(BaseHTTPRequestHandler):
    server_version = "GpcSmsHelper/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}", flush=True)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            state = get_state()
            write_json(self, 200, {
                "ok": True,
                "status": "ok",
                "has_otp": bool(state.get("last_otp")),
                "last_scan_at": state.get("last_scan_at"),
                "last_error": state.get("last_error"),
            })
            return
        if parsed.path in ("/otp", "/latest-otp"):
            query = parse_qs(parsed.query)
            consume = str(query.get("consume", ["0"])[0]).strip().lower() in {"1", "true", "yes"}
            after_ms = parse_timestamp_ms(query.get("after_ms", query.get("after", ["0"]))[0])
            phone = str((query.get("phone") or query.get("phone_e164") or query.get("phone_number") or [""])[0]).strip()
            state = get_state()
            record = select_otp_record(state, after_ms=after_ms, phone=phone)
            if not record:
                write_json(self, 200, {"ok": True, "otp": "", "code": "", "status": "waiting", "message": "No verification code found yet"})
                return
            payload = {"ok": True, "status": "found", **record}
            if consume:
                consume_otp_record(phone=phone, record=record)
            write_json(self, 200, payload)
            return
        write_json(self, 404, {"ok": False, "error": "not_found"})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a local macOS Messages HTTP helper for GPC SMS OTP.")
    parser.add_argument("--host", default=HOST, help="Bind host, default 127.0.0.1")
    parser.add_argument("--port", type=int, default=PORT, help="Bind port, default 18767")
    parser.add_argument("--db", default=DEFAULT_DB, help="Path to macOS Messages chat.db")
    parser.add_argument("--interval", type=float, default=2.0, help="Message scan interval in seconds")
    parser.add_argument("--no-keywords", action="store_true", help="Accept any numeric OTP without GPC/OpenAI keywords")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        require_macos()
        db_path = Path(os.path.expanduser(args.db)).resolve()
        scanner = threading.Thread(
            target=scan_loop,
            args=(db_path, args.interval, not args.no_keywords),
            daemon=True,
        )
        scanner.start()
        server = ThreadingHTTPServer((args.host, int(args.port)), HelperHandler)
        print(f"GPC SMS Helper listening on http://{args.host}:{int(args.port)}", flush=True)
        print("Make sure iPhone SMS forwarding is enabled to this machine's Messages app.", flush=True)
        server.serve_forever()
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
