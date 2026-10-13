"""
services/qdrant_service.py
Official Qdrant Vector Database integration for EchoMind AI.
Implements collection validation, 384-dimensional dense vector upsert,
canonical similarity search, deletion, and real connection health probing.
"""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

DEFAULT_COLLECTION = os.getenv("QDRANT_COLLECTION", "echomind_memories")
VECTOR_DIMENSION = 384
DISTANCE_METRIC = "Cosine"

def is_qdrant_configured():
    url = (os.getenv("QDRANT_URL") or "").strip()
    return bool(url and not url.startswith("your_"))

def get_qdrant_headers():
    key = os.getenv("QDRANT_API_KEY", "").strip()
    return {
        "api-key": key,
        "Content-Type": "application/json"
    }

def get_qdrant_url():
    return (os.getenv("QDRANT_URL") or "").rstrip("/")

def ensure_collection(collection_name=None):
    """
    Validates or creates named collection on Qdrant with 384-dim Cosine vectors.
    Returns True if collection exists or was successfully created.
    """
    if not is_qdrant_configured():
        return False
    coll = collection_name or DEFAULT_COLLECTION
    base = get_qdrant_url()
    try:
        r = requests.get(f"{base}/collections/{coll}", headers=get_qdrant_headers(), timeout=8)
        if r.status_code == 200:
            return True
        # Create collection
        body = {
            "vectors": {
                "size": VECTOR_DIMENSION,
                "distance": DISTANCE_METRIC
            }
        }
        r2 = requests.put(f"{base}/collections/{coll}", headers=get_qdrant_headers(), json=body, timeout=10)
        return r2.status_code in (200, 201)
    except Exception:
        return False

def test_qdrant_connection():
    """
    Performs real authenticated connection test to configured Qdrant endpoint.
    Returns (success: bool, status_label: str, message: str, latency_ms: int, details: dict)
    """
    if not is_qdrant_configured():
        return False, "setup_required", "QDRANT_URL not configured in .env", 0, {}

    base = get_qdrant_url()
    t0 = time.time()
    try:
        r = requests.get(f"{base}/collections", headers=get_qdrant_headers(), timeout=8)
        latency = int((time.time() - t0) * 1000)
        if r.status_code == 401 or r.status_code == 403:
            return False, "failed", f"Qdrant authentication failed ({r.status_code})", latency, {}
        if not r.ok:
            return False, "degraded", f"Qdrant returned HTTP {r.status_code}: {r.text[:100]}", latency, {}

        data = r.json()
        collections_list = data.get("result", {}).get("collections", [])
        coll_names = [c.get("name") for c in collections_list if isinstance(c, dict)]

        has_target = DEFAULT_COLLECTION in coll_names
        if not has_target:
            created = ensure_collection(DEFAULT_COLLECTION)
            has_target = created

        return True, "verified", f"Qdrant Cloud verified ({latency}ms). Collection '{DEFAULT_COLLECTION}' ready.", latency, {
            "collections_count": len(coll_names),
            "target_collection_ready": has_target,
            "dimension": VECTOR_DIMENSION,
            "metric": DISTANCE_METRIC
        }
    except Exception as e:
        latency = int((time.time() - t0) * 1000)
        return False, "failed", f"Qdrant connection error: {str(e)[:120]}", latency, {}

def upsert_point(point_id, vector, payload, collection_name=None):
    """
    Upserts a single point with 384-dimensional dense vector and rich metadata into Qdrant.
    """
    if not is_qdrant_configured():
        return False, "Local mode (Qdrant Cloud not configured)."
    if not ensure_collection(collection_name):
        return False, "Qdrant collection setup failed; stored locally."

    coll = collection_name or DEFAULT_COLLECTION
    base = get_qdrant_url()
    body = {
        "points": [
            {
                "id": str(point_id),
                "payload": payload,
                "vector": vector
            }
        ]
    }
    try:
        r = requests.put(f"{base}/collections/{coll}/points", headers=get_qdrant_headers(), json=body, timeout=12)
        if r.ok:
            return True, f"Indexed in Qdrant collection '{coll}' (384-dim {DISTANCE_METRIC})."
        return False, f"Qdrant write error ({r.status_code}): {r.text[:120]}"
    except Exception as e:
        return False, f"Qdrant write failed: {str(e)[:120]}"

def search_points(query_vector, limit=5, score_threshold=0.05, collection_name=None):
    """
    Executes real semantic search in Qdrant with query vector.
    Returns (results: list[dict], latency_ms: int, message: str).
    Never fabricates similarity scores.
    """
    if not is_qdrant_configured():
        return [], 0, "Qdrant not configured"
    coll = collection_name or DEFAULT_COLLECTION
    if not ensure_collection(coll):
        return [], 0, "Collection unavailable"

    base = get_qdrant_url()
    body = {
        "vector": query_vector,
        "limit": limit,
        "with_payload": True,
        "score_threshold": score_threshold
    }
    t0 = time.time()
    try:
        r = requests.post(f"{base}/collections/{coll}/points/search", headers=get_qdrant_headers(), json=body, timeout=12)
        latency = int((time.time() - t0) * 1000)
        if not r.ok:
            # Fallback to /points/query endpoint
            q_body = {"query": query_vector, "limit": limit, "with_payload": True}
            r2 = requests.post(f"{base}/collections/{coll}/points/query", headers=get_qdrant_headers(), json=q_body, timeout=12)
            latency = int((time.time() - t0) * 1000)
            if not r2.ok:
                return [], latency, f"Qdrant query returned {r2.status_code}"
            r = r2

        data = r.json().get("result", [])
        points = data.get("points", []) if isinstance(data, dict) else data
        results = []
        for p in points:
            if isinstance(p, dict) and p.get("payload"):
                item = dict(p["payload"])
                if "score" in p and p["score"] is not None:
                    item["score"] = round(float(p["score"]), 3)
                else:
                    item["score"] = None
                results.append(item)
        return results, latency, "Success"
    except Exception as e:
        latency = int((time.time() - t0) * 1000)
        return [], latency, f"Qdrant search error: {str(e)[:100]}"

def delete_point(point_id, collection_name=None):
    """Deletes point from Qdrant by ID."""
    if not is_qdrant_configured():
        return
    coll = collection_name or DEFAULT_COLLECTION
    base = get_qdrant_url()
    try:
        body = {"points": [str(point_id)]}
        requests.post(f"{base}/collections/{coll}/points/delete", headers=get_qdrant_headers(), json=body, timeout=8)
    except Exception:
        pass
