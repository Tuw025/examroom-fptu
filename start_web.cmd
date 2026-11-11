@echo off
chcp 65001 > nul
title Examroom FPTU - Phòng Luyện Thi
echo Đang khởi động Examroom Local...
start http://localhost:8765
cd /d "%~dp0examroom"
node server.mjs
pause
