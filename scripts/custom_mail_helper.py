import email
import html
import imaplib
import json
import os
import re
import ssl
import traceback
from datetime import datetime, timezone
from email.header import decode_header
from email.utils import getaddresses, parseaddr, parsedate_to_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def load_dotenv_file(path):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not key or key in os.environ:
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            os.environ[key] = value


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv_file(os.path.join(PROJECT_ROOT, ".env"))


HOST = "127.0.0.1"
PORT = int(os.environ.get("FLOWPILOT_CUSTOM_MAIL_HELPER_PORT", "17374"))
IMAP_HOST = os.environ.get("FLOWPILOT_CUSTOM_IMAP_HOST", "imap.mxhichina.com")
IMAP_PORT = int(os.environ.get("FLOWPILOT_CUSTOM_IMAP_PORT", "993"))
IMAP_USER = os.environ.get("FLOWPILOT_CUSTOM_IMAP_USER", "")
IMAP_PASS = os.environ.get("FLOWPILOT_CUSTOM_IMAP_PASS", "")
IMAP_MAILBOX = os.environ.get("FLOWPILOT_CUSTOM_IMAP_MAILBOX", "INBOX")
REQUEST_TIMEOUT_SECONDS = int(os.environ.get("FLOWPILOT_CUSTOM_IMAP_TIMEOUT", "45"))
DEFAULT_TOP = 20
PUBLIC_ENV_KEYS = [
    "FLOWPILOT_SUB2API_REDIRECT_URI",
]
DEFAULT_MAIL_FROM_ALLOW = [
    "no-reply@codeium.com",
    "noreply@codeium.com",
    "no-reply@windsurf.com",
    "noreply@windsurf.com",
    "noreply@tm.openai.com",
    "noreply@tm1.openai.com",
]


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(body)


def read_json_payload(handler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Invalid JSON payload: {exc}") from exc


def get_public_env_payload():
    return {key: os.environ.get(key, "") for key in PUBLIC_ENV_KEYS}


def decode_mime_header(value):
    if not value:
        return ""
    parts = []
    for chunk, charset in decode_header(value):
        if isinstance(chunk, bytes):
            parts.append(chunk.decode(charset or "utf-8", errors="ignore"))
        else:
            parts.append(str(chunk))
    return "".join(parts).strip()


def extract_text_part(message):
    if message.is_multipart():
        html_text = ""
        for part in message.walk():
            if part.get_content_maintype() == "multipart":
                continue
            if "attachment" in str(part.get("Content-Disposition") or "").lower():
                continue
            payload = part.get_payload(decode=True) or b""
            charset = part.get_content_charset() or "utf-8"
            text = payload.decode(charset, errors="ignore").strip()
            if part.get_content_type() == "text/plain" and text:
                return text
            if part.get_content_type() == "text/html" and text and not html_text:
                html_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(text))).strip()
        return html_text

    payload = message.get_payload(decode=True) or b""
    charset = message.get_content_charset() or "utf-8"
    text = payload.decode(charset, errors="ignore").strip()
    if message.get_content_type() == "text/html":
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(text))).strip()
    return text


def to_timestamp_ms(raw_date):
    if not raw_date:
        return 0
    try:
        parsed = parsedate_to_datetime(raw_date)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp() * 1000)
    except Exception:
        return 0


def to_iso_string(timestamp_ms):
    if not timestamp_ms:
        return ""
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def parse_addresses(value):
    return [addr.strip().lower() for _, addr in getaddresses([str(value or "")]) if addr.strip()]


def normalize_message(message_id, raw_bytes):
    parsed = email.message_from_bytes(raw_bytes)
    sender_name, sender_addr = parseaddr(parsed.get("From", ""))
    subject = decode_mime_header(parsed.get("Subject", ""))
    body = extract_text_part(parsed)
    timestamp_ms = to_timestamp_ms(parsed.get("Date"))
    return {
        "id": str(message_id),
        "mailbox": IMAP_MAILBOX,
        "subject": subject,
        "from": {
            "emailAddress": {
                "address": sender_addr.strip().lower(),
                "name": sender_name.strip(),
            }
        },
        "to": parse_addresses(parsed.get("To", "")),
        "cc": parse_addresses(parsed.get("Cc", "")),
        "deliveredTo": parse_addresses(parsed.get("Delivered-To", "")),
        "bodyPreview": body[:500],
        "body": {"content": body},
        "receivedDateTime": to_iso_string(timestamp_ms),
        "receivedTimestamp": timestamp_ms,
    }


def fetch_recent_messages(top=DEFAULT_TOP):
    if not IMAP_USER or not IMAP_PASS:
        raise RuntimeError("Missing FLOWPILOT_CUSTOM_IMAP_USER/FLOWPILOT_CUSTOM_IMAP_PASS")

    context = ssl.create_default_context()
    client = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=context, timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        client.login(IMAP_USER, IMAP_PASS)
        status, _ = client.select(IMAP_MAILBOX)
        if status != "OK":
            raise RuntimeError(f"Mailbox not found: {IMAP_MAILBOX}")
        status, data = client.search(None, "ALL")
        if status != "OK" or not data or not data[0]:
            return []

        message_ids = data[0].split()
        selected_ids = list(reversed(message_ids[-max(1, min(int(top or DEFAULT_TOP), 50)):]))
        messages = []
        for message_id in selected_ids:
            fetch_status, fetch_data = client.fetch(message_id, "(RFC822)")
            if fetch_status != "OK" or not fetch_data:
                continue
            raw_bytes = b""
            for item in fetch_data:
                if isinstance(item, tuple) and len(item) >= 2:
                    raw_bytes = item[1]
                    break
            if raw_bytes:
                messages.append(normalize_message(message_id.decode("utf-8", errors="ignore"), raw_bytes))
        messages.sort(key=lambda item: int(item.get("receivedTimestamp") or 0), reverse=True)
        return messages
    finally:
        try:
            client.logout()
        except Exception:
            pass


def extract_code(text, code_patterns=None):
    source = str(text or "")
    for pattern in code_patterns or []:
        try:
            source_pattern = str((pattern or {}).get("source") or "").strip()
            if not source_pattern:
                continue
            flags = str((pattern or {}).get("flags") or "").lower()
            re_flags = 0
            if "i" in flags:
                re_flags |= re.IGNORECASE
            if "m" in flags:
                re_flags |= re.MULTILINE
            if "s" in flags:
                re_flags |= re.DOTALL
            match = re.search(source_pattern, source, flags=re_flags)
            if match:
                return next((str(match.group(i) or "").strip() for i in range(1, (match.lastindex or 0) + 1) if str(match.group(i) or "").strip()), str(match.group(0) or "").strip())
        except re.error:
            continue
    for pattern in [
        r"(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})",
        r"(?:log-?in\s+code|enter\s+this\s+code)[^0-9]{0,24}(\d{6})",
        r"code(?:\s+is|[\s:])+(\d{6})",
        r"\b(\d{6})\b",
    ]:
        match = re.search(pattern, source, flags=re.IGNORECASE)
        if match:
            return match.group(1)
    return ""


def message_matches_target(message, target_email):
    target = str(target_email or "").strip().lower()
    if not target:
        return True
    recipients = set(message.get("to") or []) | set(message.get("cc") or []) | set(message.get("deliveredTo") or [])
    return target in recipients


def select_latest_code(messages, payload):
    target_email = str(payload.get("targetEmail") or "").strip().lower()
    filter_after_timestamp = int(payload.get("filterAfterTimestamp") or 0)
    excluded = {str(item).strip() for item in payload.get("excludeCodes") or [] if str(item).strip()}
    sender_filters = [str(item).strip().lower() for item in payload.get("senderFilters") or [] if str(item).strip()]
    if not sender_filters:
        sender_filters = DEFAULT_MAIL_FROM_ALLOW
    subject_filters = [str(item).strip().lower() for item in payload.get("subjectFilters") or [] if str(item).strip()]
    required_keywords = [str(item).strip().lower() for item in payload.get("requiredKeywords") or [] if str(item).strip()]

    def candidate(message, apply_time_filter):
        timestamp = int(message.get("receivedTimestamp") or 0)
        if apply_time_filter and filter_after_timestamp and timestamp and timestamp < filter_after_timestamp:
            return None
        if not message_matches_target(message, target_email):
            return None
        sender = str(message.get("from", {}).get("emailAddress", {}).get("address", "")).lower()
        subject = str(message.get("subject") or "")
        preview = str(message.get("bodyPreview") or "")
        body = str((message.get("body") or {}).get("content") or "")
        combined = " ".join([sender, subject, preview, body]).lower()
        if sender_filters and sender not in sender_filters and not any(item in combined for item in sender_filters):
            return None
        if subject_filters and not any(item in combined for item in subject_filters):
            return None
        if required_keywords and not any(item in combined for item in required_keywords):
            return None
        code = extract_code("\n".join([subject, preview, body, sender]), payload.get("codePatterns") or [])
        if not code or code in excluded:
            return None
        return {"code": code, "message": message}

    for use_time_fallback in [False, True]:
        matches = [item for item in (candidate(message, not use_time_fallback) for message in messages) if item]
        if matches:
            matches.sort(key=lambda item: int(item["message"].get("receivedTimestamp") or 0), reverse=True)
            best = matches[0]
            return {"code": best["code"], "message": best["message"], "usedTimeFallback": use_time_fallback}
    return {"code": "", "message": None, "usedTimeFallback": False}


class CustomMailHelperHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self):
        try:
            payload = read_json_payload(self)
            if self.path == "/messages":
                messages = fetch_recent_messages(payload.get("top") or DEFAULT_TOP)
                json_response(self, 200, {"ok": True, "messages": messages})
                return
            if self.path == "/code":
                messages = fetch_recent_messages(payload.get("top") or DEFAULT_TOP)
                selected = select_latest_code(messages, payload)
                json_response(self, 200, {
                    "ok": True,
                    "code": selected["code"],
                    "message": selected["message"],
                    "usedTimeFallback": selected["usedTimeFallback"],
                })
                return
            if self.path == "/health":
                json_response(self, 200, {"ok": True})
                return
            if self.path == "/env":
                json_response(self, 200, {"ok": True, "env": get_public_env_payload()})
                return
            json_response(self, 404, {"ok": False, "error": f"Unsupported path: {self.path}"})
        except Exception as exc:
            traceback.print_exc()
            json_response(self, 500, {"ok": False, "error": str(exc)})


def main():
    server = ThreadingHTTPServer((HOST, PORT), CustomMailHelperHandler)
    print(f"Custom mail helper listening on http://{HOST}:{PORT}", flush=True)
    print(f"IMAP host={IMAP_HOST}:{IMAP_PORT} user={IMAP_USER or '(unset)'} mailbox={IMAP_MAILBOX}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
