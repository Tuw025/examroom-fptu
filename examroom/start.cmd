@echo off
title Examroom Local Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :no_node

echo Dang khoi dong Examroom tai http://127.0.0.1:8765...
start "" http://127.0.0.1:8765
node server.mjs
pause
exit /b

:no_node
echo ==============================================================
echo [THONG BAO] May tinh cua ban CHUA CAI DAT Node.js!
echo Vui long tai Node.js tai https://nodejs.org/
echo ==============================================================
pause
exit /b
