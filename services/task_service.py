"""
services/task_service.py
Task validation, deduplication, governance, and persistence service for EchoMind AI.
Implements Human-in-the-Loop review (Approve, Edit, Dismiss) and SQLite persistence.
"""

import uuid
import datetime
import sqlite3

def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def validate_task_fields(task_data):
    """Validates task title and attributes."""
    if not isinstance(task_data, dict):
        return False, "Task must be a JSON object"
    title = (task_data.get("title") or "").strip()
    if not title:
        return False, "Task title cannot be empty"
    if len(title) > 300:
        return False, "Task title exceeds 300 characters"
    priority = (task_data.get("priority") or "medium").lower()
    if priority not in ("high", "medium", "low"):
        priority = "medium"
    return True, {"title": title, "priority": priority}

def save_task(conn, title, priority="medium", due_date=None, source_memory_id=None, workflow_id=None, consequential=False):
    """Saves a single task in the database with deduplication by title."""
    existing = conn.execute("SELECT id FROM tasks WHERE title=? AND status='pending'", (title,)).fetchone()
    if existing:
        return existing["id"], False

    tid = str(uuid.uuid4())
    created = stamp()
    conn.execute(
        "INSERT INTO tasks (id, title, priority, status, due_date, created_at, source_memory_id, workflow_id, consequential) "
        "VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)",
        (tid, title, priority, due_date, created, source_memory_id, workflow_id, 1 if consequential else 0)
    )
    conn.commit()
    return tid, True

def approve_proposed_tasks(conn, tasks, workflow_id=None):
    """Approves a list of proposed action items into persistent tasks queue."""
    saved = []
    for item in tasks:
        valid, validated = validate_task_fields(item)
        if not valid:
            continue
        title = validated["title"]
        prio = validated["priority"]
        due = item.get("due_date")
        src_id = item.get("source_memory_id")
        wf_id = item.get("workflow_id") or workflow_id
        consequential = bool(item.get("consequential"))

        tid, is_new = save_task(conn, title, prio, due, src_id, wf_id, consequential)
        saved.append({
            "id": tid,
            "title": title,
            "priority": prio,
            "status": "pending",
            "due_date": due,
            "source_memory_id": src_id,
            "workflow_id": wf_id,
            "consequential": consequential,
            "is_new": is_new
        })
    return saved
