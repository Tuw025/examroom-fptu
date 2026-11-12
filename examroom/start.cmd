@echo off
chcp 65001 > nul
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Máy tính của bạn chưa cài đặt Node.js!
    echo Vui lòng tải Node.js tại https://nodejs.org/
    pause
    exit /b
)

echo Đang khởi động Examroom tại http://127.0.0.1:8765...
start "" http://127.0.0.1:8765
node server.mjs
pause
