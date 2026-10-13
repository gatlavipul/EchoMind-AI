"""
services package for EchoMind AI.
Exposes modular services for embeddings, Qdrant vector memory,
Lyzr agent reasoning, Omi wearable integration, tasks, and workflows.
"""

from .embedding_service import generate_embedding, cosine_similarity, get_embedding_info, chunk_text
from .qdrant_service import is_qdrant_configured, ensure_collection, test_qdrant_connection, upsert_point, search_points, delete_point
from .lyzr_service import is_lyzr_configured, test_lyzr_connection, call_lyzr_agent, parse_agent_json, validate_agent_response, deterministic_agent_fallback
from .omi_service import is_omi_configured, test_omi_connection, normalize_omi_payload, run_prompt_processor, OMI_PROMPTS, OMI_MCP_TOOLS, check_omi_key_type, omi_headers
from .task_service import validate_task_fields, save_task, approve_proposed_tasks
from .workflow_service import run_cognitive_pipeline, local_search_memories
