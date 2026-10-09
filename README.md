# ChatGPT Clone — React + FastAPI + OpenRouter (free models)

A full-stack ChatGPT-style app. The React UI talks to a FastAPI backend, which acts as a gateway
to [OpenRouter](https://openrouter.ai) and only exposes **free** models (`:free` / zero-priced).

```
frontend/  Vite + React + TypeScript   (http://localhost:5173, proxies /api -> :8001)
backend/   FastAPI + httpx + SQLite    (http://localhost:8001)
```

## Features
- Streaming responses (SSE) with a **Stop** button; partial replies are saved
- Free-model picker with search (live list from OpenRouter, cached 10 min)
- Conversation history in SQLite: grouped by date, rename, delete, auto-title
- Regenerate last reply, copy message, copy code blocks
- Markdown + GFM tables + syntax highlighting
- Custom instructions (system prompt), dark/light theme, mobile-friendly sidebar
- OpenRouter key stays server-side; never sent to the browser

## Quick start (Windows)
Run each in its own terminal from the project root:
```
.\start-backend.cmd
.\start-frontend.cmd
```
The scripts use the virtualenv's Python directly, so no activation is needed (and PowerShell's
execution policy doesn't matter). The backend script creates `.venv` on first run.

## Manual setup

### 1. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env          # then put your key in OPENROUTER_API_KEY
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8001
```
`uvicorn` is installed inside `.venv`, so run it via `.venv\Scripts\python -m uvicorn` (or activate
the venv first). The Vite dev server finds the backend on port 8001 or 8000 automatically at startup
(start the backend first); for any other port set `API_PROXY_TARGET=http://localhost:<port>`.
Get a free key at https://openrouter.ai/keys. The key can also live in `temp/.env` at the project root
(gitignored); `backend/.env` takes precedence if both exist.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

## Docs
End-to-end workflows for every feature (frontend → backend → OpenRouter): [docs/TECHNICAL_WORKFLOWS.md](docs/TECHNICAL_WORKFLOWS.md)

## API
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Status + whether the API key is configured |
| GET | `/api/models` | Free OpenRouter models |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/{id}` | Conversation with messages |
| PATCH | `/api/conversations/{id}` | Rename `{ "title": "..." }` |
| DELETE | `/api/conversations/{id}` | Delete |
| POST | `/api/chat` | `{ model, message, conversation_id?, system_prompt?, regenerate? }` → SSE stream of `meta` / `delta` / `done` / `error` events |

## Notes
- Free OpenRouter models are rate-limited (roughly 20 req/min and a daily cap). A 429 error is shown inline, so you can switch models and retry.
- For production, run `npm run build` and serve `frontend/dist` behind the same origin as the API (or set `VITE_API_URL` and `CORS_ORIGINS`).
