@echo off
REM Starts the Vite dev server (proxies /api to the backend on port 8001).
cd /d "%~dp0frontend"
if not exist "node_modules" call npm install
npm run dev
