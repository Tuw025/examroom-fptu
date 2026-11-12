@echo off
title Examroom FPTU - Tool Cao De Tu Dong
cd /d "%~dp0"

echo ==============================================================
echo        EXAMROOM FPTU - CONG CU CAO DE THI TU DONG
echo ==============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [THONG BAO] May tinh cua ban CHUA CAI DAT Node.js!
    echo.
    echo De chay duoc tool cao de va ung dung local:
    echo 1. Hay tai va cai dat Node.js tai: https://nodejs.org/ (Chon ban LTS)
    echo 2. Sau khi cai dat xong, hay mo lai file start_crawler.cmd nay.
    echo.
    pause
    exit /b
)

where npm >nul 2>nul
if not exist "node_modules\tesseract.js" (
    echo Dang cai dat thu vien bo tro (chi can chay 1 lan dau tien)...
    call npm install
    echo.
)

echo Dang khoi dong tool cao de...
node crawler.mjs
pause
