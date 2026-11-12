@echo off
title Examroom FPTU - Phong Luyen Thi Local
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :no_node

echo Dang khoi dong Examroom Local tai http://127.0.0.1:8765...
start "" http://127.0.0.1:8765

cd /d "%~dp0examroom"
node server.mjs
pause
exit /b

:no_node
echo ==============================================================
echo [THONG BAO] May tinh cua ban CHUA CAI DAT Node.js!
echo.
echo De chay duoc ung dung local:
echo 1. Hay tai va cai dat Node.js tai: https://nodejs.org/
echo 2. Cai dat xong, hay mo lai file start_web.cmd nay.
echo.
echo Hoac ban co the dung truc tiep ban Web Online khong can cai dat tai:
echo https://tuw025.github.io/examroom-fptu/
echo ==============================================================
echo.
pause
exit /b
