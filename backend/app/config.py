import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")
# Fallback: project-level temp/.env (gitignored) for local secrets
load_dotenv(_BACKEND_DIR.parent / "temp" / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")
APP_NAME = os.getenv("APP_NAME", "ChatGPT Clone")
DB_PATH = os.getenv("DB_PATH", str(Path(__file__).resolve().parent.parent / "chat.db"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
DEFAULT_SYSTEM_PROMPT = os.getenv(
    "DEFAULT_SYSTEM_PROMPT",
    "You are a helpful assistant. Format answers with Markdown when useful.",
)
MODELS_CACHE_TTL = int(os.getenv("MODELS_CACHE_TTL", "600"))
