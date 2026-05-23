#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if command -v python3 >/dev/null 2>&1; then
  exec python3 scripts/custom_mail_helper.py
fi

if command -v python >/dev/null 2>&1; then
  exec python scripts/custom_mail_helper.py
fi

echo "Python 3 not found. Please install Python 3.10+ and try again."
read -r -p "Press Enter to exit..."
