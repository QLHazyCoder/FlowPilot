@echo off
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\custom_mail_helper.py
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  python scripts\custom_mail_helper.py
  goto :eof
)

echo Python 3 not found. Please install Python 3.10+ and try again.
pause
