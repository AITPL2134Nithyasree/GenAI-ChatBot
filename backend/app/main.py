import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import db
from .config import CORS_ORIGINS, DEFAULT_SYSTEM_PROMPT, OPENROUTER_API_KEY
from .openrouter import OpenRouterError, list_free_models, stream_chat


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="ChatGPT Clone API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    model: str
    message: str = ""
    conversation_id: str | None = None
    system_prompt: str | None = None
    regenerate: bool = False


class RenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@app.get("/api/health")
def health():
    return {"ok": True, "api_key_configured": bool(OPENROUTER_API_KEY)}


@app.get("/api/models")
async def models():
    try:
        return await list_free_models()
    except Exception as e:
        raise HTTPException(502, f"Could not fetch models from OpenRouter: {e}")


@app.get("/api/conversations")
def conversations():
    return db.list_conversations()


@app.get("/api/conversations/{conv_id}")
def conversation(conv_id: str):
    conv = db.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@app.patch("/api/conversations/{conv_id}")
def rename(conv_id: str, body: RenameRequest):
    if not db.rename_conversation(conv_id, body.title.strip()):
        raise HTTPException(404, "Conversation not found")
    return {"ok": True}


@app.delete("/api/conversations/{conv_id}")
def delete(conv_id: str):
    if not db.delete_conversation(conv_id):
        raise HTTPException(404, "Conversation not found")
    return {"ok": True}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _make_title(text: str) -> str:
    title = " ".join(text.split())
    return (title[:47] + "...") if len(title) > 50 else (title or "New chat")


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(503, "OPENROUTER_API_KEY is not set on the server. Add it to backend/.env.")
    # This gateway only serves free models.
    try:
        free_ids = {m["id"] for m in await list_free_models()}
    except Exception as e:
        raise HTTPException(502, f"Could not fetch models from OpenRouter: {e}")
    if req.model not in free_ids:
        raise HTTPException(400, f"Model '{req.model}' is not an available free model.")

    if req.regenerate:
        if not req.conversation_id or not db.get_conversation(req.conversation_id):
            raise HTTPException(404, "Conversation not found")
        conv_id = req.conversation_id
        db.delete_last_assistant_message(conv_id)
    else:
        if not req.message.strip():
            raise HTTPException(400, "Message is empty")
        if req.conversation_id:
            if not db.get_conversation(req.conversation_id):
                raise HTTPException(404, "Conversation not found")
            conv_id = req.conversation_id
        else:
            conv_id = db.create_conversation(_make_title(req.message), req.model)["id"]
        db.add_message(conv_id, "user", req.message)

    system = (req.system_prompt or DEFAULT_SYSTEM_PROMPT).strip()
    messages = ([{"role": "system", "content": system}] if system else []) + db.history(conv_id)

    async def event_stream():
        yield _sse({"type": "meta", "conversation_id": conv_id})
        parts: list[str] = []
        try:
            async for delta in stream_chat(req.model, messages):
                parts.append(delta)
                yield _sse({"type": "delta", "content": delta})
            yield _sse({"type": "done"})
        except OpenRouterError as e:
            yield _sse({"type": "error", "message": str(e)})
        except Exception as e:
            yield _sse({"type": "error", "message": f"Upstream error: {e}"})
        finally:
            # Persist whatever was generated, including partial output if the client stopped.
            if parts:
                db.add_message(conv_id, "assistant", "".join(parts), req.model)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
