@echo off
title Examroom Local Server
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [THONG BAO] May tinh cua ban chua cai dat Node.js!
    echo Vui long tai Node.js tai https://nodejs.org/ (Chon ban LTS)
    pause
    exit /b
)

echo Dang khoi dong Examroom tai http://127.0.0.1:8765...
start "" http://127.0.0.1:8765
node server.mjs
pause
