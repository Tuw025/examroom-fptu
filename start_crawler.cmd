@echo off
title Examroom FPTU - Tool Cao De Tu Dong
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :no_node

if not exist "node_modules\tesseract.js" (
    echo Dang cai dat thu vien bo tro, chi can chay 1 lan dau tien...
    call npm install
    echo.
)

echo Dang khoi dong tool cao de...
node crawler.mjs
pause
exit /b

:no_node
echo ==============================================================
echo [THONG BAO] May tinh cua ban CHUA CAI DAT Node.js!
echo.
echo Tool cao de can co Node.js de chay.
echo Vui long tai va cai dat Node.js tai: https://nodejs.org/
echo Sau khi cai dat xong, hay mo lai file start_crawler.cmd nay.
echo ==============================================================
echo.
pause
exit /b
