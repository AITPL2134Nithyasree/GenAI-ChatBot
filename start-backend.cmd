@echo off
REM Starts the FastAPI backend using the project's virtualenv (no activation needed).
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo Creating virtualenv and installing dependencies...
  python -m venv .venv || exit /b 1
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8001
