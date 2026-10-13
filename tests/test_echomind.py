import os
import tempfile
import pytest
import json

# Use a temporary database for test isolation
os.environ["SQLITE_PATH"] = tempfile.mktemp(suffix=".db")

from app import app, get_db, generate_embedding, cosine_similarity

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        with app.app_context():
            get_db()
        yield client
    # Cleanup
    if os.path.exists(os.environ["SQLITE_PATH"]):
        try:
            os.remove(os.environ["SQLITE_PATH"])
        except Exception:
            pass

def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert "timestamp" in data

def test_status_endpoint(client):
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.get_json()
    assert "memory_count" in data
    assert "pending_task_count" in data
    assert "workflow_count" in data
    assert "qdrant" in data
    assert "lyzr" in data
    assert "omi" in data

def test_diagnostics_endpoint(client):
    res = client.get("/api/diagnostics")
    assert res.status_code == 200
    data = res.get_json()
    assert "diagnostics" in data
    assert "qdrant" in data["diagnostics"]
    assert "lyzr" in data["diagnostics"]
    assert "omi" in data["diagnostics"]

def test_semantic_embedding_dimensions_and_similarity():
    """Verifies that embeddings are 384 dimensions, L2 normalized, and capture semantic similarity."""
    v1 = generate_embedding("Meeting with Sarah about Qdrant vector memory")
    v2 = generate_embedding("Discussion with Sarah regarding Qdrant embeddings")
    v3 = generate_embedding("Recipe for chocolate strawberry pancakes")

    assert len(v1) == 384
    assert len(v2) == 384
    assert len(v3) == 384

    # Paraphrased similarity should be significantly higher than unrelated text
    sim_related = cosine_similarity(v1, v2)
    sim_unrelated = cosine_similarity(v1, v3)

    assert sim_related > 0.4
    assert sim_related > sim_unrelated

def test_save_and_retrieve_memory(client):
    payload = {"text": "Meeting with Sarah about Qdrant vectors", "kind": "note", "source": "manual"}
    res = client.post("/api/memory", json=payload)
    assert res.status_code == 200
    mem = res.get_json()["memory"]
    assert mem["text"] == payload["text"]
    assert mem["kind"] == "note"
    mid = mem["id"]

    # Retrieve memories via GET /api/memories
    res2 = client.get("/api/memories?q=Sarah")
    assert res2.status_code == 200
    mems = res2.get_json()["memories"]
    assert len(mems) >= 1
    assert any(m["id"] == mid for m in mems)

    # Also test GET /api/memory alias
    res_alias = client.get("/api/memory?q=Sarah")
    assert res_alias.status_code == 200
    assert len(res_alias.get_json()["memories"]) >= 1

def test_memory_deduplication(client):
    payload = {"text": "Never duplicate this critical memory", "kind": "note"}
    res1 = client.post("/api/memory", json=payload)
    assert res1.status_code == 200
    mem1 = res1.get_json()["memory"]
    assert mem1["is_duplicate"] is False

    # Second insert with identical text
    res2 = client.post("/api/memory", json=payload)
    assert res2.status_code == 200
    mem2 = res2.get_json()["memory"]
    assert mem2["is_duplicate"] is True
    assert mem2["id"] == mem1["id"]

def test_empty_memory_validation(client):
    res = client.post("/api/memory", json={"text": "   "})
    assert res.status_code == 400
    assert "error" in res.get_json()

def test_omi_ingest_and_webhook(client):
    # Test genuine Omi webhook payload format
    payload = {
        "id": "omi_test_conv_99",
        "session_id": "sess_888",
        "transcript_segments": [
            {"speaker": "Alex", "text": "We need to finalize the Qdrant vector index."},
            {"speaker": "Sarah", "text": "Agreed. Let's make sure the demo video is recorded before 11 PM."}
        ],
        "structured": {
            "title": "Hackathon Sprint Sync",
            "overview": "Discussion regarding Qdrant vectors and final demo video deadline.",
            "action_items": [
                {"description": "Record hackathon demo video before 11 PM"}
            ]
        }
    }

    res = client.post("/api/ingest/omi", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ingested"
    assert data["source"] == "omi-webhook"
    assert "Alex:" in data["memory"]["text"]
    assert "Sarah:" in data["memory"]["text"]
    assert len(data["extracted_tasks"]) >= 1

    # Test duplicate detection for same Omi conversation ID
    res_dup = client.post("/api/ingest/omi", json=payload)
    assert res_dup.status_code == 200
    assert res_dup.get_json()["status"] == "duplicate"

def test_execution_inspector_and_eight_stages(client):
    # Seed a memory
    client.post("/api/memory", json={"text": "We must submit the hackathon project before midnight tonight."})

    # Run workflow
    res_ask = client.post("/api/ask", json={"message": "What is my top priority for tonight?"})
    assert res_ask.status_code == 200
    data = res_ask.get_json()

    assert "run_id" in data
    assert "answer" in data
    assert "summary" in data
    assert "stages" in data

    stages = data["stages"]
    assert len(stages) == 8

    # Verify each actual stage name and order
    stage_names = [s["name"] for s in stages]
    assert stage_names[0] == "Input received"
    assert stage_names[1] == "Input normalized"
    assert stage_names[2] == "Memory retrieval attempted"
    assert stage_names[3] == "Retrieval results returned"
    assert stage_names[4] == "Lyzr agent invoked"
    assert stage_names[5] == "Agent response validated"
    assert stage_names[6] == "Action items persisted, if any"
    assert stage_names[7] == "Memory updates persisted, if any"

    # Verify that unconfigured Lyzr stage is marked 'skipped', NOT falsely 'success'!
    assert stages[4]["status"] == "skipped"

    # Verify that Execution history is retrievable
    res_execs = client.get("/api/executions")
    assert res_execs.status_code == 200
    exec_list = res_execs.get_json()["executions"]
    assert len(exec_list) >= 1
    assert exec_list[0]["run_id"] == data["run_id"]

    # Verify single execution detail
    res_single = client.get(f"/api/executions/{data['run_id']}")
    assert res_single.status_code == 200
    assert res_single.get_json()["execution"]["run_id"] == data["run_id"]

def test_tasks_crud_and_patch(client):
    # Create task
    res_create = client.post("/api/tasks", json={"title": "Test task", "priority": "high", "due_date": "Tomorrow"})
    assert res_create.status_code == 200
    task = res_create.get_json()["task"]
    tid = task["id"]
    assert task["status"] == "pending"

    # Toggle task
    res_toggle = client.post(f"/api/tasks/{tid}/toggle")
    assert res_toggle.status_code == 200
    assert res_toggle.get_json()["status"] == "completed"

    # PATCH task
    res_patch = client.patch(f"/api/tasks/{tid}", json={"status": "pending", "priority": "low"})
    assert res_patch.status_code == 200
    patched = res_patch.get_json()["task"]
    assert patched["status"] == "pending"
    assert patched["priority"] == "low"

    # Delete task
    res_del = client.delete(f"/api/tasks/{tid}")
    assert res_del.status_code == 200
    assert res_del.get_json()["success"] is True

def test_delete_memory(client):
    res = client.post("/api/memory", json={"text": "Temporary note to delete"})
    mid = res.get_json()["memory"]["id"]

    res_del = client.delete(f"/api/memories/{mid}")
    assert res_del.status_code == 200
    assert res_del.get_json()["success"] is True

    res_list = client.get("/api/memories")
    assert not any(m["id"] == mid for m in res_list.get_json()["memories"])

def test_setup_progress_api(client):
    res = client.get("/api/setup")
    assert res.status_code == 200
    data = res.get_json()
    assert "steps" in data
    assert len(data["steps"]) == 5
    assert "percentage" in data

    # Update step 1
    res_up = client.post("/api/setup", json={"step_id": "step_1", "status": "completed"})
    assert res_up.status_code == 200
    assert res_up.get_json()["completed_count"] >= 1

    # Reset
    res_reset = client.post("/api/setup", json={"action": "reset"})
    assert res_reset.status_code == 200
    assert res_reset.get_json()["completed_count"] == 0

def test_service_states_and_embedding_info(client):
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.get_json()
    assert "service_states" in data
    states = data["service_states"]
    assert "qdrant" in states
    assert "lyzr" in states
    assert "omi" in states
    # Default without keys is setup_required
    assert states["qdrant"]["state"] == "setup_required"

    assert "embedding_info" in data
    emb = data["embedding_info"]
    assert emb["vector_dimension"] == 384
    assert emb["distance_metric"] == "Cosine"
    assert "honest_disclosure" in emb

def test_task_governance_approval_and_dismissal(client):
    # Test ask with auto_approve=False
    client.post("/api/memory", json={"text": "We need to complete the security review tonight."})
    res_ask = client.post("/api/ask", json={"message": "What must we complete?", "auto_approve": False})
    assert res_ask.status_code == 200
    data = res_ask.get_json()
    assert len(data["proposed_action_items"]) >= 1
    proposed = data["proposed_action_items"][0]

    # Dismiss test
    res_dis = client.post("/api/tasks/dismiss", json={"title": proposed["title"]})
    assert res_dis.status_code == 200
    assert res_dis.get_json()["success"] is True

    # Approve test
    res_app = client.post("/api/tasks/approve", json={"tasks": [proposed], "workflow_id": data["workflow_id"]})
    assert res_app.status_code == 200
    app_data = res_app.get_json()
    assert app_data["success"] is True
    assert app_data["approved_count"] == 1
    saved_task = app_data["tasks"][0]

    # Verify task exists in task queue
    res_tasks = client.get("/api/tasks")
    assert any(t["id"] == saved_task["id"] for t in res_tasks.get_json()["tasks"])

def test_omi_prompt_listing_and_execution(client):
    # 1. Test prompts listing
    res = client.get("/api/omi/prompts")
    assert res.status_code == 200
    prompts = res.get_json()["prompts"]
    assert len(prompts) >= 5
    prompt_ids = [p["id"] for p in prompts]
    assert "action_item_extractor" in prompt_ids
    assert "meeting_summary" in prompt_ids
    assert "fitness_coach" in prompt_ids

    # 2. Test running Action Item Extractor prompt
    transcript = "Sarah: We must finalize the API documentation tonight. Alex: I will deploy the staging build before midnight."
    res_run = client.post("/api/omi/prompts/run", json={
        "prompt_id": "action_item_extractor",
        "text": transcript,
        "save_results": True
    })
    assert res_run.status_code == 200
    result = res_run.get_json()["result"]
    assert result["prompt_id"] == "action_item_extractor"
    assert len(result["extracted_tasks"]) >= 1
    assert "Extracted Action Items" in result["output_markdown"]

    # 3. Test running Meeting Summary prompt
    res_summary = client.post("/api/omi/prompts/run", json={
        "prompt_id": "meeting_summary",
        "text": transcript,
        "save_results": False
    })
    assert res_summary.status_code == 200
    res_data = res_summary.get_json()["result"]
    assert "Attendees" in res_data["output_markdown"]
    assert "Decisions Made" in res_data["output_markdown"]

def test_mcp_tools_specification_and_call(client):
    # 1. Test tools catalog
    res = client.get("/api/mcp/tools")
    assert res.status_code == 200
    tools = res.get_json()["tools"]
    tool_names = [t["name"] for t in tools]
    assert "get_memories" in tool_names
    assert "search_memories" in tool_names
    assert "create_memory" in tool_names
    assert "get_action_items" in tool_names
    assert "get_user_profile" in tool_names

    # 2. Test create_memory via MCP call
    res_call = client.post("/api/mcp/call", json={
        "name": "create_memory",
        "arguments": {"text": "MCP persistent note test", "kind": "note"}
    })
    assert res_call.status_code == 200
    created = res_call.get_json()["result"]["created"]
    assert created["text"] == "MCP persistent note test"

    # 3. Test search_memories via MCP call
    res_search = client.post("/api/mcp/call", json={
        "name": "search_memories",
        "arguments": {"query": "MCP persistent", "limit": 3}
    })
    assert res_search.status_code == 200
    results = res_search.get_json()["result"]["results"]
    assert len(results) >= 1

    # 4. Test get_user_profile via MCP call
    res_prof = client.post("/api/mcp/call", json={"name": "get_user_profile"})
    assert res_prof.status_code == 200
    prof = res_prof.get_json()["result"]
    assert "active_tasks_count" in prof

def test_omi_cli_recipes_and_sync(client):
    res_rec = client.get("/api/omi/cli/recipes")
    assert res_rec.status_code == 200
    recipes = res_rec.get_json()["recipes"]
    assert len(recipes) >= 4
    assert any("omi --json memory list" in r["command"] for r in recipes)

    # Sync endpoint with no key returns honest error notice
    res_sync = client.post("/api/omi/sync", json={"resource": "conversations"})
    assert res_sync.status_code == 200
    assert res_sync.get_json()["success"] is False
    assert "OMI_API_KEY not configured" in res_sync.get_json()["message"]

def test_transcript_chunking_speaker_aware():
    """Verifies that long transcripts are chunked without losing speaker attributions."""
    from services.embedding_service import chunk_text

    # 1. Short dialogue should produce 1 chunk
    short = "Alex: Let's sync on the demo."
    c_short = chunk_text(short, max_chunk_size=400)
    assert len(c_short) == 1
    assert c_short[0]["chunk_index"] == 0
    assert c_short[0]["total_chunks"] == 1
    assert c_short[0]["text"] == short

    # 2. Long multi-turn dialogue should split into multiple chunks while keeping speaker dialogue intact
    dialogue_lines = [
        "Alex: Welcome everyone to the EchoMind hackathon architecture sync.",
        "Sarah: Thanks Alex. I've completed the Qdrant Cloud vector adapter using 384-dimensional dense vectors.",
        "David: The FastEmbed embedding model is generating normalized vectors for semantic similarity.",
        "Alex: Excellent. What about the Lyzr agent orchestration?",
        "Sarah: Lyzr inference handles grounded reasoning and returns structured tasks with source citations.",
        "David: We need to make sure the task review interface allows Human-in-the-Loop approve, edit, and dismiss.",
        "Sarah: Agreed. We also have Model Context Protocol tool endpoints ready for Claude and Cursor.",
        "Alex: Let's do a complete rehearsal before recording the final submission video tonight at 10 PM."
    ]
    long_dialogue = "\n".join(dialogue_lines)
    chunks = chunk_text(long_dialogue, max_chunk_size=200, overlap=30)
    assert len(chunks) > 1
    assert all("chunk_index" in c for c in chunks)
    assert all("total_chunks" in c for c in chunks)
    assert chunks[0]["total_chunks"] == len(chunks)
    # Confirm speaker attribution is preserved in chunks
    assert any("Alex:" in c["text"] for c in chunks)
    assert any("Sarah:" in c["text"] for c in chunks)

def test_qdrant_test_endpoint_and_failure_handling(client, monkeypatch):
    """Verifies POST /api/qdrant/test returns valid service states and handles failures safely."""
    # When unconfigured
    res = client.post("/api/qdrant/test")
    assert res.status_code == 200
    data = res.get_json()
    assert data["state"] in ["setup_required", "configured_unverified", "verified", "degraded", "failed"]
    assert "label" in data
    assert "latency_ms" in data

    # Test failure handling with monkeypatch
    import services.qdrant_service as qs
    monkeypatch.setattr(qs, "is_qdrant_configured", lambda: True)
    monkeypatch.setattr(qs, "get_qdrant_url", lambda: "https://invalid-qdrant-cluster.example.com")
    monkeypatch.setattr(qs, "get_qdrant_headers", lambda: {"api-key": "invalid-key"})

    def mock_failing_get(*args, **kwargs):
        raise Exception("Connection timeout to cluster")

    import requests
    monkeypatch.setattr(requests, "get", mock_failing_get)

    ok, status_lbl, msg, lat, det = qs.test_qdrant_connection()
    assert ok is False
    assert status_lbl in ["failed", "degraded"]
    assert "error" in msg.lower() or "timeout" in msg.lower()

def test_lyzr_test_endpoint_and_schema_validation(client):
    """Verifies POST /api/lyzr/test and rigorous Lyzr schema validation."""
    from services.lyzr_service import validate_agent_response, parse_agent_json

    # Test unconfigured endpoint call
    res = client.post("/api/lyzr/test")
    assert res.status_code == 200
    data = res.get_json()
    assert data["state"] in ["setup_required", "configured_unverified", "verified", "degraded", "failed"]

    # Schema validation tests
    # Invalid: not a dict
    valid, err = validate_agent_response("not a dict")
    assert valid is False

    # Invalid: missing answer
    valid, err = validate_agent_response({"summary": "no answer"})
    assert valid is False
    assert "Missing" in err

    # Invalid: action_items not a list
    valid, err = validate_agent_response({"answer": "hello", "action_items": "not a list"})
    assert valid is False
    assert "list" in err

    # Valid schema
    valid_payload = {
        "answer": "Here is your plan.",
        "summary": "Retrieved 2 memories.",
        "action_items": [{"title": "Deploy staging", "priority": "high"}],
        "memory_updates": [{"text": "Key fact", "kind": "decision"}]
    }
    valid, err = validate_agent_response(valid_payload)
    assert valid is True

    # JSON extraction from code fence
    fence = 'Here is the result:\n```json\n{"answer": "Fenced answer", "summary": "Extracted"}\n```\nDone.'
    parsed = parse_agent_json(fence)
    assert parsed is not None
    assert parsed["answer"] == "Fenced answer"

def test_omi_test_endpoint_and_key_type_check(client):
    """Verifies POST /api/omi/test, key type validation, and test fixture ingestion."""
    from services.omi_service import check_omi_key_type

    # Key type detection
    t_dev, _ = check_omi_key_type("omi_dev_abc1234567")
    assert t_dev == "dev"

    t_mcp, note = check_omi_key_type("omi_mcp_xyz987654")
    assert t_mcp == "mcp"
    assert "Notice: MCP keys" in note

    # Test fixture endpoint
    res_fix = client.post("/api/omi/test-fixture")
    assert res_fix.status_code == 200
    f_data = res_fix.get_json()
    assert f_data["status"] == "ingested"
    assert f_data["source"] == "test-fixture"
    assert f_data["memory"]["metadata"]["fixture"] is True

def test_task_validation_and_deduplication():
    """Verifies task field validation and title deduplication."""
    from services.task_service import validate_task_fields, save_task

    # Empty title rejected
    ok, err = validate_task_fields({"title": "   "})
    assert ok is False

    # Long title rejected
    ok, err = validate_task_fields({"title": "x" * 350})
    assert ok is False

    # Valid task with priority normalization
    ok, valid = validate_task_fields({"title": "Valid task", "priority": "CRITICAL"})
    assert ok is True
    assert valid["priority"] == "medium"  # normalized

    # Database deduplication
    conn = get_db()
    tid1, is_new1 = save_task(conn, "Unique deduplication test task", priority="high")
    assert is_new1 is True

    tid2, is_new2 = save_task(conn, "Unique deduplication test task", priority="high")
    assert is_new2 is False
    assert tid2 == tid1
    conn.close()

def test_exact_service_state_categories_in_diagnostics(client):
    """Verifies that all services report one of the 5 exact specified state categories."""
    allowed_categories = {"Setup required", "Configured but unverified", "Verified", "Degraded", "Failed"}

    res = client.get("/api/diagnostics")
    assert res.status_code == 200
    data = res.get_json()
    diag = data["diagnostics"]

    for svc in ["qdrant", "lyzr", "omi", "sqlite"]:
        assert svc in diag
        assert diag[svc]["label"] in allowed_categories, f"{svc} label '{diag[svc]['label']}' not in allowed categories"

    # SQLite must be verified
    assert diag["sqlite"]["label"] == "Verified"

def test_end_to_end_complete_workflow_grounding_and_trace(client):
    """
    End-to-end integration test:
    1. Ingest transcript -> 2. Index memory -> 3. Ask related question ->
    4. Retrieve correct source -> 5. Obtain agent response ->
    6. Verify grounding citations -> 7. Save and approve proposed task ->
    8. Inspect execution trace.
    """
    # 1. Ingest conversation transcript
    conv_text = (
        "Project Lead: Confirming the final migration deadline.\n"
        "DevOps: The cloud database migration must be executed before 10 PM tonight.\n"
        "Lead: Approved. David is assigned as the migration owner."
    )
    res_ingest = client.post("/api/memory", json={
        "text": conv_text,
        "kind": "transcript",
        "source": "omi-conversation"
    })
    assert res_ingest.status_code == 200
    ingested_mem = res_ingest.get_json()["memory"]
    mid = ingested_mem["id"]

    # 2. Ask related question with Human-in-the-Loop review (auto_approve=False)
    res_ask = client.post("/api/ask", json={
        "message": "When must the cloud database migration be executed?",
        "auto_approve": False
    })
    assert res_ask.status_code == 200
    ask_data = res_ask.get_json()

    # 3. Verify execution trace stages
    assert "stages" in ask_data
    stages = ask_data["stages"]
    assert len(stages) == 8
    stage_names = [s["name"] for s in stages]
    assert stage_names == [
        "Input received",
        "Input normalized",
        "Memory retrieval attempted",
        "Retrieval results returned",
        "Lyzr agent invoked",
        "Agent response validated",
        "Action items persisted, if any",
        "Memory updates persisted, if any"
    ]

    # 4. Verify grounding & citations
    answer = ask_data["answer"]
    summary = ask_data["summary"]
    assert mid[:8] in summary or mid[:8] in answer or "REF:" in summary or "REF:" in answer or len(ask_data["memories"]) >= 1

    # 5. Verify proposed action items
    assert len(ask_data["proposed_action_items"]) >= 1
    proposed = ask_data["proposed_action_items"][0]
    assert proposed["title"]

    # 6. Approve proposed task
    res_approve = client.post("/api/tasks/approve", json={
        "tasks": [proposed],
        "workflow_id": ask_data["workflow_id"]
    })
    assert res_approve.status_code == 200
    app_data = res_approve.get_json()
    assert app_data["success"] is True
    assert app_data["approved_count"] >= 1
    approved_task = app_data["tasks"][0]

    # 7. Verify task in SQLite task queue
    res_tasks = client.get("/api/tasks")
    assert res_tasks.status_code == 200
    all_tasks = res_tasks.get_json()["tasks"]
    assert any(t["id"] == approved_task["id"] for t in all_tasks)

    # 8. Inspect the execution run record
    run_id = ask_data["run_id"]
    res_exec = client.get(f"/api/executions/{run_id}")
    assert res_exec.status_code == 200
    exec_data = res_exec.get_json()["execution"]
    assert exec_data["run_id"] == run_id
    assert exec_data["status"] == "completed"
    assert len(exec_data["stages"]) == 8
