import sqlite3
import time
import uuid
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)


def list_conversations() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_conversation(conv_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not row:
            return None
        msgs = conn.execute(
            "SELECT id, role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
            (conv_id,),
        ).fetchall()
    return {**dict(row), "messages": [dict(m) for m in msgs]}


def create_conversation(title: str, model: str | None) -> dict:
    now = time.time()
    conv = {"id": str(uuid.uuid4()), "title": title, "model": model, "created_at": now, "updated_at": now}
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, model, created_at, updated_at) "
            "VALUES (:id, :title, :model, :created_at, :updated_at)",
            conv,
        )
    return conv


def rename_conversation(conv_id: str, title: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, conv_id))
    return cur.rowcount > 0


def delete_conversation(conv_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    return cur.rowcount > 0


def delete_last_assistant_message(conv_id: str) -> None:
    """Used by regenerate: drop the latest reply if it came from the assistant."""
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM messages WHERE role = 'assistant' AND id = ("
            " SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1)",
            (conv_id,),
        )


def add_message(conv_id: str, role: str, content: str, model: str | None = None) -> dict:
    now = time.time()
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "role": role,
        "content": content,
        "model": model,
        "created_at": now,
    }
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, model, created_at) "
            "VALUES (:id, :conversation_id, :role, :content, :model, :created_at)",
            msg,
        )
        conn.execute(
            "UPDATE conversations SET updated_at = ?, model = COALESCE(?, model) WHERE id = ?",
            (now, model, conv_id),
        )
    return msg


def history(conv_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at", (conv_id,)
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in rows]
