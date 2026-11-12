@echo off
title Examroom FPTU - Phong Luyen Thi Local
cd /d "%~dp0"

echo ==============================================================
echo        EXAMROOM FPTU - PHONG LUYEN THI TRAC NGHIEM LOCAL
echo ==============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [THONG BAO] May tinh cua ban CHUA CAI DAT Node.js!
    echo.
    echo De chay duoc ung dung local:
    echo 1. Hay tai va cai dat Node.js tai: https://nodejs.org/ (Chon ban LTS)
    echo 2. Cai dat xong, hay mo lai file start_web.cmd nay.
    echo.
    echo Hoac ban co the dung truc tiep ban Web Online khong can cai dat tai:
    echo https://tuw025.github.io/examroom-fptu/
    echo.
    pause
    exit /b
)

echo Dang khoi dong Examroom Local tai http://127.0.0.1:8765...
start "" http://127.0.0.1:8765

cd /d "%~dp0examroom"
node server.mjs
pause
