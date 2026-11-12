@echo off
chcp 65001 > nul
title Examroom FPTU - Phòng Luyện Thi
cd /d "%~dp0"

echo ======================================================
echo    EXAMROOM FPTU - PHÒNG LUYỆN THI TRẮC NGHIỆM LOCAL
echo ======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LỖI] Máy tính của bạn CHƯA CÀI ĐẶT Node.js!
    echo.
    echo Để chạy được ứng dụng luyện thi trên máy cá nhân:
    echo 1. Hãy tải và cài đặt Node.js miễn phí tại: https://nodejs.org/ (chọn bản LTS).
    echo 2. Cài đặt xong, hãy nhấp đúp mở lại file start_web.cmd này.
    echo.
    echo Hoặc bạn có thể dùng trực tiếp bản Web Online không cần cài đặt tại:
    echo https://tuw025.github.io/examroom-fptu/
    echo.
    pause
    exit /b
)

echo Đang khởi động Examroom Local tại http://127.0.0.1:8765...
start "" http://127.0.0.1:8765

cd /d "%~dp0examroom"
node server.mjs
pause
