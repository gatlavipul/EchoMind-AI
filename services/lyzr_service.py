"""
services/lyzr_service.py
Official Lyzr Agent Studio integration for EchoMind AI.
Connects to Lyzr inference API with strict JSON schema validation,
grounded memory citation prompts, and deterministic fallback planning.
"""

import os
import json
import re
import time
import requests
from dotenv import load_dotenv

load_dotenv()

DEFAULT_INFERENCE_URL = "https://agent-prod.studio.lyzr.ai/v3/inference/chat/"

def is_lyzr_configured():
    key = (os.getenv("LYZR_API_KEY") or "").strip()
    agent_id = (os.getenv("LYZR_AGENT_ID") or "").strip()
    return bool(key and not key.startswith("your_") and agent_id and not agent_id.startswith("your_"))

def get_lyzr_inference_url():
    return os.getenv("LYZR_INFERENCE_URL", DEFAULT_INFERENCE_URL)

def test_lyzr_connection():
    """
    Tests live connection to Lyzr Agent Studio endpoint.
    Returns (success: bool, status_label: str, message: str, latency_ms: int, details: dict)
    """
    if not is_lyzr_configured():
        return False, "setup_required", "LYZR_API_KEY or LYZR_AGENT_ID not configured in .env", 0, {}

    url = get_lyzr_inference_url()
    key = os.getenv("LYZR_API_KEY").strip()
    agent_id = os.getenv("LYZR_AGENT_ID").strip()

    body = {
        "user_id": os.getenv("LYZR_USER_ID", "echomind-health-check"),
        "agent_id": agent_id,
        "session_id": "echomind-health-session",
        "message": "Health check ping: confirm readiness."
    }

    t0 = time.time()
    try:
        r = requests.post(
            url,
            headers={"x-api-key": key, "Content-Type": "application/json", "accept": "application/json"},
            json=body,
            timeout=15
        )
        latency = int((time.time() - t0) * 1000)
        if r.status_code == 401 or r.status_code == 403:
            return False, "failed", f"Lyzr authentication failed ({r.status_code})", latency, {}
        if not r.ok:
            return False, "degraded", f"Lyzr returned HTTP {r.status_code}: {r.text[:100]}", latency, {}
        return True, "verified", f"Lyzr Agent Studio verified ({latency}ms). Agent '{agent_id}' active.", latency, {"agent_id": agent_id}
    except Exception as e:
        latency = int((time.time() - t0) * 1000)
        return False, "failed", f"Lyzr connection error: {str(e)[:120]}", latency, {}

def parse_agent_json(raw_text):
    """Extracts valid JSON dictionary from raw agent output."""
    if not raw_text:
        return None
    try:
        return json.loads(raw_text)
    except Exception:
        pass
    # Regex extract markdown code fence
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    start = raw_text.find('{')
    end = raw_text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw_text[start:end+1])
        except Exception:
            pass
    return None

def validate_agent_response(data):
    """Enforces strict schema compliance on agent outputs."""
    if not isinstance(data, dict):
        return False, "Agent response is not a valid JSON object"
    if not data.get("answer") or not isinstance(data.get("answer"), str):
        return False, "Missing or empty 'answer' field"

    actions = data.get("action_items")
    if actions is not None:
        if not isinstance(actions, list):
            return False, "'action_items' must be a list"
        for item in actions:
            if not isinstance(item, dict) or not item.get("title"):
                return False, "Each action item must have a 'title'"

    updates = data.get("memory_updates")
    if updates is not None:
        if not isinstance(updates, list):
            return False, "'memory_updates' must be a list"
        for u in updates:
            if not isinstance(u, dict) or not u.get("text"):
                return False, "Each memory update must have a 'text' field"

    return True, "Valid structured response"

def call_lyzr_agent(message, retrieved_memories):
    """
    Dispatches request to Lyzr Agent Studio with ground-truth memory context.
    Returns (raw_response: str, status_msg: str, latency_ms: int, call_state: str)
    call_state is one of: 'success', 'failed', 'skipped'.
    """
    if not is_lyzr_configured():
        return None, "Lyzr credentials not configured; local planning active.", 0, "skipped"

    url = get_lyzr_inference_url()
    key = os.getenv("LYZR_API_KEY").strip()
    agent_id = os.getenv("LYZR_AGENT_ID").strip()

    context_lines = []
    for m in retrieved_memories:
        m_id = (m.get("id") or "mem")[:8]
        src = m.get("source", "vault")
        txt = m.get("text", "")
        context_lines.append(f"- [REF: {m_id}] ({src}): {txt}")

    context_str = "\n".join(context_lines) if context_lines else "(No relevant past memories found in vault.)"

    system_instruction = (
        "You are EchoMind AI, an autonomous personal cognitive assistant with persistent second-brain memory. "
        "Strict Grounding Rules:\n"
        "1. Treat retrieved memories as evidence. If evidence is missing, state it clearly instead of inventing facts.\n"
        "2. Include memory references (e.g. [REF: ...]) in your answer when citing evidence.\n"
        "3. Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "answer": "Clear, grounded answer directly addressing the user.",\n'
        '  "summary": "One sentence explaining which memories were relevant and why.",\n'
        '  "action_items": [\n'
        '    {"title": "Specific task title", "priority": "high|medium|low", "due_date": null, "consequential": false}\n'
        "  ],\n"
        '  "memory_updates": [\n'
        '    {"text": "Key fact or decision to persist in memory", "kind": "decision"}\n'
        "  ],\n"
        '  "used_memory_ids": ["id1", "id2"],\n'
        '  "requires_confirmation": false\n'
        "}\n"
        "No conversational markdown wrapper outside the JSON."
    )

    body = {
        "user_id": os.getenv("LYZR_USER_ID", "echomind-user"),
        "agent_id": agent_id,
        "session_id": "echomind-main-session",
        "message": f"{system_instruction}\n\nUser Question: {message}\n\nRetrieved Evidence Context:\n{context_str}"
    }

    t0 = time.time()
    try:
        r = requests.post(
            url,
            headers={"x-api-key": key, "Content-Type": "application/json", "accept": "application/json"},
            json=body,
            timeout=30
        )
        latency = int((time.time() - t0) * 1000)
        if not r.ok:
            return None, f"Lyzr returned status {r.status_code}", latency, "failed"

        data = r.json()
        raw_res = data.get("response") or data.get("message") or data.get("output") or data
        raw_str = json.dumps(raw_res) if isinstance(raw_res, (dict, list)) else str(raw_res)
        return raw_str, "Lyzr agent inference verified.", latency, "success"
    except Exception as e:
        latency = int((time.time() - t0) * 1000)
        return None, f"Lyzr request error: {str(e)[:120]}", latency, "failed"

def deterministic_agent_fallback(message, retrieved_memories):
    """
    Transparent local autonomous planning engine when Lyzr API is offline or unconfigured.
    Synthesizes citations, extracts action items, identifies decisions, and enforces the structured contract.
    """
    action_items = []
    memory_updates = []
    citations = []
    used_ids = [m.get("id") for m in retrieved_memories if m.get("id")]

    action_keywords = ["need to", "must", "finish", "complete", "deploy", "finalize", "before", "due", "priority", "submit", "prepare", "test"]
    consequential_keywords = ["delete", "drop", "wipe", "purchase", "pay", "deploy to prod", "send email"]

    for m in retrieved_memories:
        mid = (m.get("id") or "mem")[:8]
        t = m.get("text", "")
        sentences = re.split(r'[.\n!]', t)
        for s in sentences:
            s_clean = s.strip()
            if any(k in s_clean.lower() for k in action_keywords) and len(s_clean) > 8:
                prio = "high" if any(w in s_clean.lower() for w in ["tonight", "due", "urgent", "must", "deadline"]) else "medium"
                is_consequential = any(ck in s_clean.lower() for ck in consequential_keywords)
                if not any(a["title"].lower() == s_clean.lower() for a in action_items):
                    action_items.append({
                        "title": s_clean[:95],
                        "priority": prio,
                        "due_date": "Tonight" if "tonight" in s_clean.lower() else None,
                        "consequential": is_consequential,
                        "source_memory_id": m.get("id")
                    })
                    if f"[REF: {mid}]" not in citations:
                        citations.append(f"[REF: {mid}]")

    if not action_items and retrieved_memories:
        m0 = retrieved_memories[0]
        m0_id = (m0.get("id") or "mem")[:8]
        action_items.append({
            "title": f"Review retrieved context: {m0.get('text', '')[:65]}...",
            "priority": "medium",
            "due_date": None,
            "consequential": False,
            "source_memory_id": m0.get("id")
        })
        citations.append(f"[REF: {m0_id}]")

    if "decision" in message.lower() or "decide" in message.lower():
        memory_updates.append({
            "text": f"Decision point recorded regarding: '{message[:80]}'",
            "kind": "decision"
        })

    cit_str = f" (Citing: {', '.join(citations)})" if citations else ""
    summary = (
        f"Recalled {len(retrieved_memories)} memory item(s) from persistent vault. "
        f"Synthesized {len(action_items)} concrete action item(s){cit_str}."
    ) if retrieved_memories else "No prior evidence found in vault for this query. Storing new request as context."

    answer = (
        f"Autonomous plan for '{message}':\n\n"
        f"Based on your recalled memory context{cit_str}, here is your synthesized action roadmap:\n"
        + ("\n".join(f"• [{a['priority'].upper()}] {a['title']}" for a in action_items) if action_items else "• No active action items identified. Save a note or transcript to begin.")
        + "\n\nAll tasks have been persisted to your Action Items queue."
    )

    return {
        "answer": answer,
        "summary": summary,
        "action_items": action_items[:5],
        "memory_updates": memory_updates,
        "used_memory_ids": used_ids,
        "requires_confirmation": any(a.get("consequential") for a in action_items)
    }
