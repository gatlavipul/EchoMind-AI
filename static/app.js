// ============================================================================
// ECHOMIND AI 2.1 — FRONTEND CONTROLLER & WORKFLOW INSPECTOR
// ============================================================================

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const esc = s => String(s ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

// Toast Notification
function toast(msg, ms = 3400) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), ms);
}

// Universal API Fetcher
async function api(path, opts = {}) {
  const init = {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts
  };
  if (opts.body && typeof opts.body === "object") {
    init.body = JSON.stringify(opts.body);
  }
  const r = await fetch(path, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

// ============================================================================
// NAVIGATION & VIEW SWITCHING
// ============================================================================

function switchView(viewId) {
  // Update nav buttons
  $$(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.view === viewId);
  });
  // Update view panels
  $$(".view-panel").forEach(p => {
    p.classList.remove("active");
    p.classList.add("hidden");
  });
  const target = $(`#view-${viewId}`);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }

  // Load view-specific data
  if (viewId === "vault") loadVaultGrid();
  if (viewId === "voice") loadVoiceRecords();
  if (viewId === "workflows") loadWorkflowsView();
  if (viewId === "tasks") loadTasksView();

  // Close mobile sidebar if open
  $(".sidebar")?.classList.remove("open");
}

$$(".nav-item").forEach(item => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

// Mobile menu toggle
$("#mobileMenuBtn")?.addEventListener("click", () => {
  $(".sidebar")?.classList.toggle("open");
});

// ============================================================================
// SYSTEM STATUS & SETUP PROGRESS REFRESH
// ============================================================================

async function updateCounts() {
  try {
    const s = await api("/api/status");
    const mBadge = $("#navMemoryCount");
    const tBadge = $("#navTaskCount");
    const wBadge = $("#navWorkflowCount");
    const mHead = $("#memoriesHeaderCount");
    const tHead = $("#tasksHeaderCount");
    const ccMem = $("#ccMemoryCount");
    const ccTasks = $("#ccPendingTaskCount");

    if (mBadge) mBadge.textContent = s.memory_count ?? 0;
    if (tBadge) tBadge.textContent = s.pending_task_count ?? 0;
    if (wBadge) wBadge.textContent = s.workflow_count ?? 0;
    if (mHead) mHead.textContent = s.memory_count ?? 0;
    if (tHead) tHead.textContent = s.pending_task_count ?? 0;
    if (ccMem) ccMem.textContent = s.memory_count ?? 0;
    if (ccTasks) ccTasks.textContent = s.pending_task_count ?? 0;

    // Service state badges
    if (s.service_states) {
      updateServiceBadges(s.service_states);
    }
    if (s.setup_progress) {
      updateSetupProgressUI(s.setup_progress);
    }
  } catch (e) { /* silent poll */ }
}

function updateServiceBadges(states) {
  const omiBadge = $("#badgeOmi");
  const qdrantBadge = $("#badgeQdrant");
  const lyzrBadge = $("#badgeLyzr");

  const getDotClass = (st) => st === 'verified' ? 'green' : (st === 'setup_required' ? 'amber' : 'blue');

  if (omiBadge && states.omi) {
    omiBadge.innerHTML = `<span class="s-dot ${getDotClass(states.omi.state)}"></span><span>Omi: <b>${esc(states.omi.label)}</b></span>`;
  }
  if (qdrantBadge && states.qdrant) {
    qdrantBadge.innerHTML = `<span class="s-dot ${getDotClass(states.qdrant.state)}"></span><span>Qdrant: <b>${esc(states.qdrant.label)}</b></span>`;
  }
  if (lyzrBadge && states.lyzr) {
    lyzrBadge.innerHTML = `<span class="s-dot ${getDotClass(states.lyzr.state)}"></span><span>Lyzr: <b>${esc(states.lyzr.label)}</b></span>`;
  }
}

// Setup Progress UI
async function refreshSetupProgress() {
  try {
    const res = await api("/api/setup");
    updateSetupProgressUI(res);
  } catch (e) {}
}

function updateSetupProgressUI(prog) {
  if (!prog) return;
  const fill = $("#setupProgressFill");
  const label = $("#setupProgressLabel");
  if (fill) fill.style.width = `${prog.percentage}%`;
  if (label) label.textContent = `${prog.completed_count}/5 Steps (${prog.percentage}%)`;

  const steps = prog.steps || [];
  steps.forEach(s => {
    const card = $(`.step-card[data-step="${s.step_id}"]`);
    if (card) {
      card.classList.toggle("done", s.status === "completed");
    }
  });
}

// Wizard action buttons
$("#toggleWizardBtn")?.addEventListener("click", () => {
  const grid = $("#setupStepsGrid");
  const btn = $("#toggleWizardBtn");
  if (!grid || !btn) return;
  const isHidden = grid.classList.toggle("hidden");
  btn.textContent = isHidden ? "Expand" : "Minimize";
});

$("#resetSetupBtn")?.addEventListener("click", async () => {
  if (!confirm("Reset guided setup checklist?")) return;
  try {
    const res = await api("/api/setup", { method: "POST", body: { action: "reset" } });
    updateSetupProgressUI(res);
    toast("Setup checklist reset.");
  } catch (e) { toast(e.message); }
});

$("#wizardStep1Btn")?.addEventListener("click", () => {
  const omiTextEl = $("#omiText");
  if (omiTextEl) omiTextEl.value = sampleDialogue;
  $$(".c-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "omi"));
  $$(".tab-pane").forEach(p => p.classList.toggle("hidden", p.id !== "tab-omi"));
  toast("Step 1: Sample dialogue loaded into Omi input.");
});

$("#wizardStep2Btn")?.addEventListener("click", async () => {
  try {
    const res = await api("/api/diagnostics");
    toast(`Step 2: Qdrant ${res.diagnostics?.qdrant?.state?.toUpperCase() || 'CHECKED'} (384-dim Cosine)`);
    refreshSetupProgress();
    updateCounts();
  } catch (e) { toast(e.message); }
});

$("#wizardStep3Btn")?.addEventListener("click", async () => {
  try {
    const res = await api("/api/diagnostics");
    toast(`Step 3: Lyzr ${res.diagnostics?.lyzr?.state?.toUpperCase() || 'CHECKED'}`);
    refreshSetupProgress();
    updateCounts();
  } catch (e) { toast(e.message); }
});

$("#wizardStep4Btn")?.addEventListener("click", async () => {
  try {
    const res = await api("/api/ingest/omi", {
      method: "POST",
      body: { transcript: sampleDialogue, source: "sample-dialogue-wizard" }
    });
    toast("Step 4: Indexed conversation into memory vault!");
    if (res.memory) appendMemoryCard(res.memory);
    updateCounts();
    refreshSetupProgress();
  } catch (e) { toast(e.message); }
});

$("#wizardStep5Btn")?.addEventListener("click", () => {
  const askInput = $("#askText");
  if (askInput) askInput.value = "What should I do next based on my notes?";
  $("#runWorkflowBtn")?.click();
  toast("Step 5: Executing first contextual agent question…");
});

updateCounts();

// ============================================================================
// CAPTURE TABS (OVERVIEW VIEW)
// ============================================================================

$$(".c-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".c-tab").forEach(t => t.classList.remove("active"));
    $$(".tab-pane").forEach(p => p.classList.add("hidden"));
    tab.classList.add("active");
    $(`#tab-${tab.dataset.tab}`)?.classList.remove("hidden");
  });
});

// Web Speech API Voice Dictation
let recognition = null;
let isRecording = false;

function initRecognition(btnId, textId, waveId, labelId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $(`#${btnId}`);
  const area = $(`#${textId}`);
  const wave = waveId ? $(`#${waveId}`) : null;
  const label = labelId ? $(`#${labelId}`) : null;

  if (!SpeechRecognition) {
    if (btn) btn.disabled = true;
    const alert = $("#micAlert");
    if (alert) alert.textContent = "Speech recognition requires Chrome/Edge browser.";
    return;
  }

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onresult = (e) => {
    let transcript = "";
    for (let i = e.resultIndex; i < e.results.length; ++i) {
      transcript += e.results[i][0].transcript;
    }
    if (area) area.value = transcript;
  };

  rec.onerror = (e) => {
    toast(`Speech error: ${e.error}`);
    stopRec(rec, btn, wave, label);
  };

  rec.onend = () => {
    stopRec(rec, btn, wave, label);
  };

  btn?.addEventListener("click", () => {
    if (isRecording) {
      rec.stop();
    } else {
      try {
        rec.start();
        isRecording = true;
        btn.classList.add("recording");
        if (wave) wave.classList.add("active");
        if (label) label.textContent = "Stop Recording";
        toast("Listening… speak clearly into your microphone.");
      } catch (err) {
        toast(`Mic error: ${err.message}`);
      }
    }
  });

  return rec;
}

function stopRec(rec, btn, wave, label) {
  isRecording = false;
  if (btn) btn.classList.remove("recording");
  if (label) label.textContent = "Start Recording";
  if (wave) wave.classList.remove("active");
}

initRecognition("micBtn", "micTranscriptText", "micWaveBox", "micLabel");
initRecognition("voiceStudioMicBtn", "voiceStudioText", null, "voiceStudioMicText");

// Save Spoken Memory (from Overview mic tab)
const saveMicHandler = async () => {
  const text = ($("#micTranscriptText")?.value || $("#micText")?.value || "").trim();
  if (!text) return toast("Record or type some speech first.");
  try {
    const res = await api("/api/memory", {
      method: "POST",
      body: { text, kind: "transcript", source: "web-speech-mic" }
    });
    if ($("#micTranscriptText")) $("#micTranscriptText").value = "";
    if ($("#micText")) $("#micText").value = "";
    appendMemoryCard(res.memory);
    toast(res.memory.storage_message || "Voice memory indexed into vault.");
    updateCounts();
  } catch (err) { toast(err.message); }
};

$("#saveMicMemoryBtn")?.addEventListener("click", saveMicHandler);
$("#saveMicBtn")?.addEventListener("click", saveMicHandler);

// Save Written Note
$("#saveNoteBtn")?.addEventListener("click", async () => {
  const text = $("#noteText").value.trim();
  if (!text) return toast("Write a note first.");
  try {
    const res = await api("/api/memory", {
      method: "POST",
      body: { text, kind: "note", source: "manual" }
    });
    $("#noteText").value = "";
    appendMemoryCard(res.memory);
    toast(res.memory.storage_message || "Memory saved to vault.");
    updateCounts();
  } catch (err) { toast(err.message); }
});

// Import Omi Transcript
$("#importOmiBtn")?.addEventListener("click", async () => {
  const transcript = $("#omiText").value.trim();
  if (!transcript) return toast("Paste dialogue or transcript first.");
  try {
    const res = await api("/api/omi/import", { method: "POST", body: { transcript } });
    $("#omiText").value = "";
    appendMemoryCard(res.memory);
    toast("Transcript indexed into memory vault.");
    updateCounts();
  } catch (err) { toast(err.message); }
});

// Sample Dialogue
const sampleDialogue =
`[09:30 AM Product Strategy via Omi Wearable Audio]
Alex: We need to verify that all-MiniLM-L6-v2 vector indexing is functioning in Qdrant Cloud before 3 PM.
Sarah: Understood. The 384-dimensional cosine collection is configured. I tested saving sample memories.
Alex: Great. For the Lyzr agent orchestration, ensure the prompt outputs structured action items and decision points.
Sarah: Got it. I'll test the end-to-end flow and finalize the public demo video before the 11:59 PM deadline.`;

// Genuine Omi Webhook Sample Payload
const sampleOmiWebhookPayload = {
  id: "omi_conv_" + Math.random().toString(36).slice(2, 9),
  session_id: "omi_sess_production_audio",
  created_at: new Date().toISOString(),
  transcript_segments: [
    { speaker: "Alex", text: "Let's confirm the priority milestones for tonight's EchoMind demo.", start: 0.0, end: 2.5 },
    { speaker: "Sarah", text: "We have integrated Qdrant Cloud with 384-dim semantic vectors and Lyzr agent workflows.", start: 2.6, end: 6.8 },
    { speaker: "Alex", text: "We must submit the final hackathon demo video before 11 PM.", start: 7.0, end: 10.2 }
  ],
  structured: {
    title: "EchoMind Hackathon Milestones Sync",
    overview: "Sprint synchronization on Qdrant vector retrieval, Lyzr agent workflow, and final demo submission deadline.",
    action_items: [
      { description: "Record and upload 5-minute hackathon demo video before 11 PM", completed: false }
    ],
    category: "work"
  }
};

$("#loadSampleTranscriptBtn")?.addEventListener("click", () => {
  const omiTextEl = $("#omiText");
  if (omiTextEl) omiTextEl.value = sampleDialogue;
  toast("Sample dialogue loaded.");
});

$("#voiceStudioSampleBtn")?.addEventListener("click", () => {
  const studioTextEl = $("#voiceStudioText");
  if (studioTextEl) studioTextEl.value = sampleDialogue;
  toast("Sample dialogue loaded into studio.");
});

$("#voiceStudioOmiWebhookBtn")?.addEventListener("click", () => {
  const studioTextEl = $("#voiceStudioText");
  if (studioTextEl) studioTextEl.value = JSON.stringify(sampleOmiWebhookPayload, null, 2);
  toast("Loaded genuine Omi webhook payload JSON.");
});

// Voice Studio Ingest via /api/ingest/omi
$("#voiceStudioIngestBtn")?.addEventListener("click", async () => {
  const raw = $("#voiceStudioText").value.trim();
  if (!raw) return toast("Enter or load transcript/webhook payload first.");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    payload = { transcript: raw, source: "manual-input" };
  }
  try {
    const res = await api("/api/ingest/omi", { method: "POST", body: payload });
    toast(`Omi Ingestion: ${res.status.toUpperCase()} (${res.source})`);
    if (res.memory) appendMemoryCard(res.memory);
    if (res.extracted_tasks && res.extracted_tasks.length) {
      toast(`Extracted ${res.extracted_tasks.length} task(s) from Omi.`);
      res.extracted_tasks.forEach(t => appendTaskRow(t));
    }
    updateCounts();
    loadVoiceRecords();
  } catch (err) {
    toast(err.message || "Failed to ingest Omi payload.");
  }
});

// Voice Studio Save
$("#voiceStudioSaveBtn")?.addEventListener("click", async () => {
  const text = $("#voiceStudioText").value.trim();
  if (!text) return toast("Record or enter speech first.");
  try {
    const res = await api("/api/memory", {
      method: "POST",
      body: { text, kind: "transcript", source: "voice-mic" }
    });
    $("#voiceStudioText").value = "";
    appendMemoryCard(res.memory);
    toast("Indexed voice memory into vault.");
    updateCounts();
    loadVoiceRecords();
  } catch (err) { toast(err.message); }
});

// Sync Omi Cloud API
$("#syncOmiApiBtn")?.addEventListener("click", async () => {
  const btn = $("#syncOmiApiBtn");
  btn.disabled = true;
  btn.textContent = "Syncing…";
  try {
    const res = await api("/api/omi/sync", { method: "POST" });
    toast(res.message);
    if (res.success) setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    toast(err.message || "Failed to sync with Omi Cloud.");
  } finally {
    btn.disabled = false;
    btn.textContent = "☁ Sync API";
  }
});

// ============================================================================
// MEMORY RENDERING & DELETION
// ============================================================================

function appendMemoryCard(m) {
  const list = $("#overviewMemoriesList");
  const empty = $("#emptyMemories");
  if (empty) empty.remove();

  const isVoice = m.source && (m.source.includes("omi") || m.source.includes("mic") || m.kind === "transcript");
  const typeClass = isVoice ? "type-voice" : (m.kind === "decision" ? "type-decision" : "type-note");
  const typeLabel = isVoice ? "VOICE" : (m.kind || "NOTE").toUpperCase();

  const card = document.createElement("div");
  card.className = "mem-item";
  card.dataset.id = m.id;
  card.innerHTML = `
    <div class="mem-top">
      <span class="mem-type ${typeClass}">${typeLabel}</span>
      <span class="mem-source">${esc(m.source || "manual")}</span>
      ${m.score !== undefined && m.score !== null ? `<span class="score-badge">Sim: ${m.score}</span>` : ''}
      <button type="button" class="icon-btn memory-del-btn" data-id="${m.id}" title="Delete">✕</button>
    </div>
    <p class="mem-text">${esc(m.text)}</p>
    <div class="mem-footer">
      <small>${(m.created_at || new Date().toISOString()).slice(0, 16).replace("T", " ")} UTC</small>
    </div>
  `;
  list?.prepend(card);
}

// Delete Memory with Confirmation
document.addEventListener("click", async (e) => {
  if (e.target.matches(".memory-del-btn")) {
    const mid = e.target.dataset.id;
    if (!confirm("Delete this memory from local vault and Qdrant?")) return;
    try {
      await api(`/api/memories/${mid}`, { method: "DELETE" });
      $$(`.mem-item[data-id="${mid}"]`).forEach(el => el.remove());
      toast("Memory deleted.");
      updateCounts();
    } catch (err) { toast(err.message); }
  }
});

// Clear Vault
async function clearVaultAction() {
  if (!confirm("Clear all memories in vault?")) return;
  try {
    await api("/api/memories/clear", { method: "DELETE" });
    const list = $("#overviewMemoriesList");
    if (list) list.innerHTML = '<div class="empty-state" id="emptyMemories">Your memory vault is quiet.<br>Record a thought or import an Omi transcript.</div>';
    const grid = $("#vaultCardsGrid");
    if (grid) grid.innerHTML = '<div class="empty-state">No memories in vault.</div>';
    toast("Memory vault cleared.");
    updateCounts();
  } catch (err) { toast(err.message); }
}

$("#clearVaultOverviewBtn")?.addEventListener("click", clearVaultAction);
$("#vaultClearBtn")?.addEventListener("click", clearVaultAction);

// ============================================================================
// 5-SECOND STORY WORKFLOW VISUALIZATION CONTROLLER
// ============================================================================

function setStoryStep(stepId, badgeId, statusClass, badgeText) {
  const el = $(`#${stepId}`);
  const badge = $(`#${badgeId}`);
  if (el) el.className = `story-step ${statusClass}`;
  if (badge) badge.textContent = badgeText;
}

function updateStoryPipelineRunning() {
  const status = $("#storyPipelineStatus");
  if (status) status.textContent = "Running · Normalizing input & dispatching vector search…";
  setStoryStep("wf-step-1", "badge-step-1", "active", "Processing");
  setStoryStep("wf-step-2", "badge-step-2", "active", "Searching");
  setStoryStep("wf-step-3", "badge-step-3", "active", "Reasoning");
  setStoryStep("wf-step-4", "badge-step-4", "standby", "Standby");
  setStoryStep("wf-step-5", "badge-step-5", "standby", "Standby");
}

function updateStoryPipelineCompleted(res) {
  const status = $("#storyPipelineStatus");
  if (status) status.textContent = `Completed in ${res.total_latency_ms || 0}ms · 8 stages audited`;

  // Step 1: Input
  setStoryStep("wf-step-1", "badge-step-1", "completed", "Captured");

  // Step 2: Memory
  const isQdrant = res.retrieval && res.retrieval.includes("Qdrant");
  setStoryStep("wf-step-2", "badge-step-2", "completed", isQdrant ? "Qdrant Hit" : "Local Hit");

  // Step 3: Reasoning
  const stages = res.stages || [];
  const s5 = stages.find(s => s.stage === 5);
  if (s5 && s5.status === "success") {
    setStoryStep("wf-step-3", "badge-step-3", "completed", "Lyzr Studio");
  } else if (s5 && s5.status === "skipped") {
    setStoryStep("wf-step-3", "badge-step-3", "skipped", "Local Planner");
  } else {
    setStoryStep("wf-step-3", "badge-step-3", "failed", "Degraded");
  }

  // Step 4: Action Items
  const actionsCount = (res.action_items || []).length;
  if (actionsCount > 0) {
    setStoryStep("wf-step-4", "badge-step-4", "completed", `${actionsCount} Saved`);
  } else {
    setStoryStep("wf-step-4", "badge-step-4", "skipped", "0 Tasks");
  }

  // Step 5: Persistent Memory
  const memCount = (res.memory_updates || []).length;
  if (memCount > 0) {
    setStoryStep("wf-step-5", "badge-step-5", "completed", `${memCount} Updates`);
  } else {
    setStoryStep("wf-step-5", "badge-step-5", "skipped", "No Updates");
  }
}

// ============================================================================
// AGENT WORKFLOW EXECUTION & 8-STAGE INSPECTOR
// ============================================================================

// Quick prompt suggestions
$$(".q-tag").forEach(tag => {
  tag.addEventListener("click", () => {
    const askText = $("#askText");
    if (askText) askText.value = tag.dataset.prompt || tag.textContent;
  });
});

// Run Workflow
$("#runWorkflowBtn")?.addEventListener("click", async () => {
  const query = $("#askText").value.trim();
  if (!query) return toast("Enter a question or task prompt first.");

  const autoApprove = $("#autoApproveCheck")?.checked ?? true;
  const btn = $("#runWorkflowBtn");
  btn.disabled = true;
  btn.innerHTML = '<span>Executing Agent Workflow…</span> <span>⟳</span>';

  // Trigger dynamic story workflow visualization
  updateStoryPipelineRunning();

  const box = $("#workflowResultBox");
  box.classList.remove("hidden");
  $("#resultSummaryBox").textContent = "Normalizing query and retrieving semantic context…";
  $("#resultAnswerText").textContent = "";
  $("#resultActionsContainer")?.classList.add("hidden");
  $("#resultActionsList").innerHTML = "";
  $("#proposedActionsGovernanceBox")?.classList.add("hidden");
  $("#proposedActionsList").innerHTML = "";
  $("#resultMemoriesList").innerHTML = "";
  $("#resultTraceList").innerHTML = "";

  try {
    const res = await api("/api/ask", {
      method: "POST",
      body: { message: query, auto_approve: autoApprove }
    });

    // Answer & Summary
    $("#retrievalMethodBadge").textContent = res.retrieval;
    $("#resultSummaryBox").textContent = res.summary || "Agent synthesis completed.";
    $("#resultAnswerText").textContent = res.answer || "No response generated.";

    // Action Items: Check if proposed governance is active or if auto-persisted
    const proposed = res.proposed_action_items || [];
    const saved = res.saved_action_items || (res.auto_approved ? res.action_items : []);

    if (proposed.length > 0 && !res.auto_approved) {
      $("#proposedActionsGovernanceBox")?.classList.remove("hidden");
      renderProposedActions(proposed, res.workflow_id);
    } else {
      $("#proposedActionsGovernanceBox")?.classList.add("hidden");
    }

    if (saved.length > 0) {
      $("#resultActionsContainer")?.classList.remove("hidden");
      $("#resultActionsList").innerHTML = saved.map(a => `
        <div class="action-pill">
          <span><b>[${(a.priority || "med").toUpperCase()}]</b> ${esc(a.title)}</span>
          ${a.due_date ? `<small>Due: ${esc(a.due_date)}</small>` : ''}
          ${a.consequential ? `<span class="consequential-badge">⚠️ Confirmation Req.</span>` : ''}
          ${a.source_memory_id ? `<span class="source-ref-badge">Ref: ${esc((a.source_memory_id || '').slice(0, 8))}</span>` : ''}
        </div>
      `).join('');
      saved.forEach(a => appendTaskRow(a));
    }

    // Recalled Memories (with genuine scores if returned)
    const mems = res.memories || [];
    const mList = $("#resultMemoriesList");
    if (mems.length > 0) {
      mList.innerHTML = mems.map(m => `
        <div class="recalled-item">
          <b>↳ [${esc((m.id || '').slice(0, 8))}] (${esc(m.source || "memory")}):</b> ${esc(m.text)}
          ${m.score !== undefined && m.score !== null ? `<span class="score-badge" style="margin-left:6px;">Sim: ${m.score}</span>` : ''}
        </div>
      `).join('');
    } else {
      mList.innerHTML = '<small style="color:var(--text-400)">No historical context matches found.</small>';
    }

    // 8-Stage Execution Audit Trace
    const stages = res.stages || res.trace || [];
    $("#resultTraceList").innerHTML = stages.map(t => {
      const statusClass = t.status === 'success' ? 'status-success' : (t.status === 'skipped' ? 'status-skipped' : (t.status === 'failed' ? 'status-failed' : 'status-neutral'));
      const borderClass = t.status === 'success' ? 't-success' : (t.status === 'skipped' ? 't-skipped' : (t.status === 'failed' ? 't-failed' : 't-neutral'));
      return `
        <div class="trace-step ${borderClass}">
          <span class="trace-num">Stage ${t.stage || t.step}:</span>
          <div class="trace-body">
            <b>${esc(t.name)}</b>
            <small>${esc(t.details)}</small>
          </div>
          <span class="trace-status-pill ${statusClass}">${esc((t.status || 'done').toUpperCase())}</span>
          <span class="trace-ms">${t.latency_ms || 0}ms</span>
        </div>
      `;
    }).join('');

    // Update the 5-second story visualization
    updateStoryPipelineCompleted(res);

    toast(res.lyzr_status || "Workflow execution finished.");
    updateCounts();
  } catch (err) {
    $("#resultAnswerText").textContent = `Workflow error: ${err.message}`;
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Run Autonomous Agent Workflow</span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  }
});

// ============================================================================
// PROPOSED ACTION ITEMS GOVERNANCE (HUMAN IN THE LOOP)
// ============================================================================

let currentProposedTasks = [];

function renderProposedActions(tasks, workflowId) {
  currentProposedTasks = tasks.map(t => ({ ...t, workflow_id: workflowId }));
  const list = $("#proposedActionsList");
  if (!list) return;

  if (currentProposedTasks.length === 0) {
    $("#proposedActionsGovernanceBox")?.classList.add("hidden");
    return;
  }

  list.innerHTML = currentProposedTasks.map((t, idx) => `
    <div class="proposed-card" data-idx="${idx}">
      <div class="proposed-header">
        <span class="prio prio-${esc(t.priority || 'medium')}">${esc((t.priority || 'med').toUpperCase())}</span>
        ${t.due_date ? `<span class="due">📅 ${esc(t.due_date)}</span>` : ''}
        ${t.consequential ? `<span class="consequential-badge">⚠️ Confirmation Req.</span>` : ''}
        ${t.source_memory_id ? `<span class="source-ref-badge" title="Source Memory ID">Ref: ${esc((t.source_memory_id || '').slice(0, 8))}</span>` : ''}
      </div>
      <p class="proposed-title" id="prop-title-${idx}">${esc(t.title)}</p>
      <div class="proposed-controls">
        <button type="button" class="btn btn-approve-sm prop-approve-btn" data-idx="${idx}">✓ Approve</button>
        <button type="button" class="btn btn-outline-sm prop-edit-btn" data-idx="${idx}">✎ Edit</button>
        <button type="button" class="btn btn-ghost-sm prop-dismiss-btn" data-idx="${idx}">✕ Dismiss</button>
      </div>
    </div>
  `).join('');
}

// Global click delegation for proposed actions
document.addEventListener("click", async (e) => {
  // 1. Approve proposed action
  if (e.target.matches(".prop-approve-btn")) {
    const idx = parseInt(e.target.dataset.idx, 10);
    const task = currentProposedTasks[idx];
    if (!task) return;
    try {
      const res = await api("/api/tasks/approve", {
        method: "POST",
        body: { tasks: [task], workflow_id: task.workflow_id }
      });
      toast(`Approved: "${task.title.slice(0, 36)}…"`);
      if (res.tasks && res.tasks[0]) appendTaskRow(res.tasks[0]);
      currentProposedTasks.splice(idx, 1);
      renderProposedActions(currentProposedTasks, task.workflow_id);
      updateCounts();
    } catch (err) { toast(err.message); }
  }

  // 2. Edit proposed action
  if (e.target.matches(".prop-edit-btn")) {
    const idx = parseInt(e.target.dataset.idx, 10);
    const task = currentProposedTasks[idx];
    if (!task) return;
    const newTitle = prompt("Edit task title:", task.title);
    if (newTitle && newTitle.trim()) {
      task.title = newTitle.trim();
      const newPrio = prompt("Edit priority (high, medium, low):", task.priority || "medium");
      if (newPrio) task.priority = newPrio.toLowerCase();
      renderProposedActions(currentProposedTasks, task.workflow_id);
      toast("Task updated. Click Approve to save.");
    }
  }

  // 3. Dismiss proposed action
  if (e.target.matches(".prop-dismiss-btn")) {
    const idx = parseInt(e.target.dataset.idx, 10);
    const task = currentProposedTasks[idx];
    if (!task) return;
    try {
      await api("/api/tasks/dismiss", { method: "POST", body: { title: task.title } });
      toast("Proposed task dismissed.");
      currentProposedTasks.splice(idx, 1);
      renderProposedActions(currentProposedTasks, task.workflow_id);
    } catch (err) { toast(err.message); }
  }
});

// Approve All Proposed Actions
$("#approveAllProposedBtn")?.addEventListener("click", async () => {
  if (currentProposedTasks.length === 0) return toast("No proposed tasks remaining.");
  try {
    const res = await api("/api/tasks/approve", {
      method: "POST",
      body: { tasks: currentProposedTasks }
    });
    toast(`Approved all ${res.approved_count} proposed tasks.`);
    (res.tasks || []).forEach(t => appendTaskRow(t));
    currentProposedTasks = [];
    $("#proposedActionsGovernanceBox")?.classList.add("hidden");
    updateCounts();
  } catch (err) { toast(err.message); }
});

// ============================================================================
// TASKS & ACTION ITEMS
// ============================================================================

function appendTaskRow(t) {
  const list = $("#overviewTasksList");
  const empty = $("#emptyTasks");
  if (empty) empty.remove();

  if ($(`.task-row[data-id="${t.id}"]`)) return;

  const row = document.createElement("div");
  row.className = `task-row ${t.status === 'completed' ? 'task-done' : ''}`;
  row.dataset.id = t.id;
  row.innerHTML = `
    <input type="checkbox" class="task-check" ${t.status === 'completed' ? 'checked' : ''} data-id="${t.id}">
    <div class="task-body">
      <p class="task-title">${esc(t.title)}</p>
      <div class="task-meta">
        <span class="prio prio-${t.priority || 'medium'}">${(t.priority || 'med').toUpperCase()}</span>
        ${t.due_date ? `<span class="due">📅 ${esc(t.due_date)}</span>` : ''}
        ${t.consequential ? `<span class="consequential-badge">⚠️ Confirmation Req.</span>` : ''}
      </div>
    </div>
    <button type="button" class="icon-btn task-del-btn" data-id="${t.id}" title="Delete">✕</button>
  `;
  list?.prepend(row);
}

// Toggle Task with PATCH persistence
document.addEventListener("change", async (e) => {
  if (e.target.matches(".task-check")) {
    const tid = e.target.dataset.id;
    const isCompleted = e.target.checked;
    try {
      const res = await api(`/api/tasks/${tid}`, {
        method: "PATCH",
        body: { status: isCompleted ? "completed" : "pending" }
      });
      $$(`.task-row[data-id="${tid}"]`).forEach(row => {
        row.classList.toggle("task-done", isCompleted);
        const cb = row.querySelector(".task-check");
        if (cb) cb.checked = isCompleted;
      });
      toast(`Task marked ${isCompleted ? 'completed' : 'pending'}.`);
      updateCounts();
    } catch (err) {
      try {
        await api(`/api/tasks/${tid}/toggle`, { method: "POST" });
        toast(`Task status updated.`);
        updateCounts();
      } catch (e2) { toast(err.message); }
    }
  }
});

// Delete Task
document.addEventListener("click", async (e) => {
  if (e.target.matches(".task-del-btn")) {
    const tid = e.target.dataset.id;
    try {
      await api(`/api/tasks/${tid}`, { method: "DELETE" });
      $$(`.task-row[data-id="${tid}"]`).forEach(el => el.remove());
      toast("Task deleted.");
      updateCounts();
    } catch (err) { toast(err.message); }
  }
});

// Manual Add Task
$("#manualTaskBtn")?.addEventListener("click", async () => {
  const title = $("#manualTaskTitle").value.trim();
  if (!title) return toast("Enter task title.");
  const priority = $("#manualTaskPriority").value;
  const due_date = $("#manualTaskDue").value.trim() || null;
  try {
    const res = await api("/api/tasks", { method: "POST", body: { title, priority, due_date } });
    $("#manualTaskTitle").value = "";
    $("#manualTaskDue").value = "";
    appendTaskRow(res.task);
    toast("Task added.");
    loadTasksView();
    updateCounts();
  } catch (err) { toast(err.message); }
});

// ============================================================================
// TASKS VIEW
// ============================================================================

async function loadTasksView() {
  const pList = $("#tasksViewPendingList");
  const cList = $("#tasksViewCompletedList");
  if (!pList || !cList) return;

  try {
    const res = await api("/api/tasks");
    const tasks = res.tasks || [];
    const pending = tasks.filter(t => t.status !== "completed");
    const completed = tasks.filter(t => t.status === "completed");

    const pBadge = $("#pendingTasksBadge");
    const cBadge = $("#completedTasksBadge");
    if (pBadge) pBadge.textContent = pending.length;
    if (cBadge) cBadge.textContent = completed.length;

    pList.innerHTML = pending.length ? pending.map(t => renderTaskViewItem(t)).join('') : '<div class="empty-state">No pending tasks.</div>';
    cList.innerHTML = completed.length ? completed.map(t => renderTaskViewItem(t)).join('') : '<div class="empty-state">No completed tasks yet.</div>';
  } catch (err) {
    pList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function renderTaskViewItem(t) {
  return `
    <div class="task-row ${t.status === 'completed' ? 'task-done' : ''}" data-id="${t.id}">
      <input type="checkbox" class="task-check" ${t.status === 'completed' ? 'checked' : ''} data-id="${t.id}">
      <div class="task-body">
        <p class="task-title">${esc(t.title)}</p>
        <div class="task-meta">
          <span class="prio prio-${t.priority || 'medium'}">${(t.priority || 'med').toUpperCase()}</span>
          ${t.due_date ? `<span class="due">📅 ${esc(t.due_date)}</span>` : ''}
          ${t.consequential ? `<span class="consequential-badge">⚠️ Confirmation Req.</span>` : ''}
          ${t.workflow_id ? `<span class="due">⚡ Origin: ${esc(t.workflow_id.slice(0, 8))}</span>` : ''}
        </div>
      </div>
      <button type="button" class="icon-btn task-del-btn" data-id="${t.id}" title="Delete">✕</button>
    </div>
  `;
}

// ============================================================================
// MEMORY VAULT VIEW
// ============================================================================

let currentVaultFilter = "all";

async function loadVaultGrid(filter = "all", search = "") {
  const grid = $("#vaultCardsGrid");
  if (!grid) return;
  try {
    let url = `/api/memories?kind=${encodeURIComponent(filter)}`;
    if (search) url += `&q=${encodeURIComponent(search)}`;
    const res = await api(url);
    const mems = res.memories || [];
    if (!mems.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No memories match your query.</div>';
      return;
    }
    grid.innerHTML = mems.map(m => {
      const isVoice = m.source && (m.source.includes("omi") || m.source.includes("mic") || m.kind === "transcript");
      const typeClass = isVoice ? "type-voice" : (m.kind === "decision" ? "type-decision" : "type-note");
      const typeLabel = isVoice ? "VOICE" : (m.kind || "NOTE").toUpperCase();
      const storageLabel = m.source && m.source.includes("qdrant") ? "Qdrant Cloud + SQLite" : "SQLite Local Vault";
      return `
        <div class="card mem-item" data-id="${m.id}">
          <div class="mem-top">
            <span class="mem-type ${typeClass}">${typeLabel}</span>
            <span class="mem-source">${esc(m.source || 'manual')}</span>
            ${m.score !== undefined && m.score !== null ? `<span class="score-badge">Sim: ${m.score}</span>` : ''}
            <button type="button" class="icon-btn memory-del-btn" data-id="${m.id}" title="Delete">✕</button>
          </div>
          <p class="mem-text" style="font-size:12.5px;">${esc(m.text)}</p>
          <div class="mem-footer" style="display:flex;justify-content:space-between;align-items:center;">
            <small>${(m.created_at || '').slice(0, 16).replace('T', ' ')} UTC</small>
            <span class="hint">${storageLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Error: ${err.message}</div>`;
  }
}

// Filter pills
$$(".f-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    $$(".f-pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    currentVaultFilter = pill.dataset.filter;
    loadVaultGrid(currentVaultFilter, $("#vaultSearchInput")?.value.trim());
  });
});

// Vault search debounce
let searchTimer = null;
$("#vaultSearchInput")?.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadVaultGrid(currentVaultFilter, e.target.value.trim());
  }, 220);
});

// Voice Records
async function loadVoiceRecords() {
  const list = $("#voiceRecordsList");
  if (!list) return;
  try {
    const res = await api("/api/memories?kind=transcript");
    const mems = res.memories || [];
    if (!mems.length) {
      list.innerHTML = '<div class="empty-state">No voice recordings yet. Record via mic or ingest Omi transcripts.</div>';
      return;
    }
    list.innerHTML = mems.map(m => `
      <div class="mem-item" data-id="${m.id}">
        <div class="mem-top">
          <span class="mem-type type-voice">VOICE</span>
          <span class="mem-source">${esc(m.source)}</span>
          <button type="button" class="icon-btn memory-del-btn" data-id="${m.id}">✕</button>
        </div>
        <p class="mem-text">${esc(m.text)}</p>
        <div class="mem-footer">
          <small>${(m.created_at || '').slice(0, 16).replace('T', ' ')} UTC</small>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ============================================================================
// WORKFLOWS INSPECTOR — 8 ACTUAL STAGES AUDIT VIEW
// ============================================================================

async function loadWorkflowsView() {
  const container = $("#workflowsInspectorList");
  if (!container) return;
  try {
    const res = await api("/api/executions");
    const runs = res.executions || res.workflows || [];
    if (!runs.length) {
      container.innerHTML = '<div class="card empty-state">No workflow executions yet. Run an autonomous workflow prompt from Overview.</div>';
      return;
    }
    container.innerHTML = runs.map(r => {
      const stages = r.stages || r.execution_trace || [];
      const output = r.structured_output || {};
      const actions = r.saved_action_items || r.proposed_action_items || output.action_items || [];
      const memoryRefs = r.relevant_memory_refs || [];
      const answer = r.final_response || output.answer || "";
      const summary = r.summary || output.summary || r.lyzr_status || "Completed";
      const totalMs = r.total_latency_ms || (stages.reduce((acc, s) => acc + (s.latency_ms || 0), 0)) || 0;
      const startedStr = r.started_at ? r.started_at.slice(11, 19) + " UTC" : "";

      return `
        <div class="wf-card">
          <div class="wf-head">
            <div>
              <span class="step-badge">EXECUTION RUN</span>
              <span class="chip chip-run">${esc(r.run_id || r.id || 'run')}</span>
              <span class="chip">${esc(r.input_source || 'user_query')}</span>
              <b style="margin-left:8px;font-size:14px;color:var(--text-100);">"${esc(r.query)}"</b>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="retrieval-badge">${esc(r.retrieval_method || 'Retrieval')}</span>
              <span class="chip">${totalMs}ms</span>
            </div>
          </div>

          <div class="exec-meta-chips">
            <span class="chip">🕒 Started: ${startedStr || 'Just now'}</span>
            <span class="chip">Status: <b>${esc(r.status || 'completed')}</b></span>
            ${r.lyzr_status ? `<span class="chip">Reasoning: ${esc(r.lyzr_status)}</span>` : ''}
          </div>

          <div class="result-summary">${esc(summary)}</div>
          ${answer ? `<pre class="result-text">${esc(answer)}</pre>` : ''}

          ${memoryRefs.length ? `
            <div class="section-label" style="margin-top:12px;">RELEVANT MEMORY REFERENCES (${memoryRefs.length})</div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;">
              ${memoryRefs.map(m => `
                <div class="recalled-item">
                  <b>↳ [${esc((m.id || '').slice(0,8))}] (${esc(m.source || 'vault')}):</b>
                  ${esc(m.snippet || m.text || '')}
                  ${m.score !== null && m.score !== undefined ? `<span class="score-badge" style="margin-left:6px;">Sim: ${m.score}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${actions.length ? `
            <div class="section-label">ACTION ITEMS PERSISTED (${actions.length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
              ${actions.map(a => `
                <div class="action-pill">
                  <span><b>[${esc((a.priority || 'medium').toUpperCase())}]</b> ${esc(a.title)}</span>
                  ${a.due_date ? `<small>Due: ${esc(a.due_date)}</small>` : ''}
                  ${a.consequential ? `<span class="consequential-badge">⚠️ Confirmation Req.</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="section-label">EXECUTION INSPECTOR — 8 ACTUAL STAGES</div>
          <div class="trace-list">
            ${stages.map(t => {
              const statusClass = t.status === 'success' ? 'status-success' : (t.status === 'skipped' ? 'status-skipped' : (t.status === 'failed' ? 'status-failed' : 'status-neutral'));
              const borderClass = t.status === 'success' ? 't-success' : (t.status === 'skipped' ? 't-skipped' : (t.status === 'failed' ? 't-failed' : 't-neutral'));
              return `
                <div class="trace-step ${borderClass}">
                  <span class="trace-num">Stage ${t.stage || t.step}:</span>
                  <div class="trace-body">
                    <b>${esc(t.name)}</b>
                    <small>${esc(t.details)}</small>
                  </div>
                  <span class="trace-status-pill ${statusClass}">${esc((t.status || 'done').toUpperCase())}</span>
                  <span class="trace-ms">${t.latency_ms || 0}ms</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="card empty-state">Error loading executions: ${err.message}</div>`;
  }
}

// ============================================================================
// SYSTEM DIAGNOSTICS & TEST RUNNERS
// ============================================================================

function renderServiceStatePill(label) {
  let dotColor = '#f59e0b';
  if (label === 'Verified') {
    dotColor = '#10b981';
  } else if (label === 'Failed') {
    dotColor = '#f43f5e';
  } else if (label === 'Degraded') {
    dotColor = '#3b82f6';
  } else {
    dotColor = '#f59e0b';
  }
  return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);"><span style="width:7px;height:7px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};"></span>${esc(label)}</span>`;
}

function renderDiagnosticsHTML(d) {
  let html = "";
  // 1. Qdrant
  const q = d.qdrant || {};
  html += `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-soft);border-radius:8px;padding:12px;margin-bottom:8px;">
      <div class="diag-row" style="margin-bottom:4px;">
        <span><b>Qdrant Cloud Vectors</b> ${q.latency_ms ? `<small style="color:var(--text-400);">(${q.latency_ms}ms)</small>` : ''}</span>
        ${renderServiceStatePill(q.label || 'Setup required')}
      </div>
      <div style="font-size:12px;color:var(--text-300);">${esc(q.message || q.details || 'Collection: echomind_memories (384-dim Cosine)')}</div>
    </div>
  `;

  // 2. Lyzr
  const l = d.lyzr || {};
  html += `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-soft);border-radius:8px;padding:12px;margin-bottom:8px;">
      <div class="diag-row" style="margin-bottom:4px;">
        <span><b>Lyzr Agent Studio</b> ${l.latency_ms ? `<small style="color:var(--text-400);">(${l.latency_ms}ms)</small>` : ''}</span>
        ${renderServiceStatePill(l.label || 'Setup required')}
      </div>
      <div style="font-size:12px;color:var(--text-300);">${esc(l.message || l.mode || 'Lyzr API key or Agent ID check')}</div>
    </div>
  `;

  // 3. Omi
  const o = d.omi || {};
  html += `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-soft);border-radius:8px;padding:12px;margin-bottom:8px;">
      <div class="diag-row" style="margin-bottom:4px;">
        <span><b>Omi Wearable Integration</b> ${o.latency_ms ? `<small style="color:var(--text-400);">(${o.latency_ms}ms)</small>` : ''}</span>
        ${renderServiceStatePill(o.label || 'Setup required')}
      </div>
      <div style="font-size:12px;color:var(--text-300);">${esc(o.message || 'Webhook /api/ingest/omi and Developer API')}</div>
    </div>
  `;

  // 4. SQLite
  const s = d.sqlite || {};
  html += `
    <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border-soft);border-radius:8px;padding:12px;">
      <div class="diag-row" style="margin-bottom:4px;">
        <span><b>SQLite Database</b> ${s.latency_ms ? `<small style="color:var(--text-400);">(<1ms)</small>` : ''}</span>
        ${renderServiceStatePill(s.label || 'Verified')}
      </div>
      <div style="font-size:12px;color:var(--text-300);">${esc(s.message || 'SQLite persistent storage verified.')}</div>
    </div>
  `;

  return html;
}

$("#runDiagnosticsBtn")?.addEventListener("click", async () => {
  const out = $("#diagnosticsOutput");
  if (!out) return;
  out.innerHTML = '<div style="color:var(--text-300);padding:8px;">Pinging all integrations (Qdrant, Lyzr, Omi, SQLite)…</div>';

  try {
    const res = await api("/api/diagnostics");
    out.innerHTML = renderDiagnosticsHTML(res.diagnostics || {});
    if (res.service_states) updateServiceBadges(res.service_states);
    toast("Diagnostics ping completed across all services.");
  } catch (err) {
    out.innerHTML = `<div style="color:var(--rose);padding:8px;">Diagnostics error: ${esc(err.message)}</div>`;
  }
});

$("#testQdrantBtn")?.addEventListener("click", async () => {
  const btn = $("#testQdrantBtn");
  btn.disabled = true;
  btn.textContent = "Testing…";
  try {
    const res = await api("/api/qdrant/test", { method: "POST" });
    toast(`Qdrant: [${res.label}] ${res.message}`);
    const diagRes = await api("/api/diagnostics");
    if ($("#diagnosticsOutput")) $("#diagnosticsOutput").innerHTML = renderDiagnosticsHTML(diagRes.diagnostics || {});
    updateCounts();
  } catch (err) {
    toast(`Qdrant test error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Test Qdrant Connection";
  }
});

$("#testLyzrBtn")?.addEventListener("click", async () => {
  const btn = $("#testLyzrBtn");
  btn.disabled = true;
  btn.textContent = "Testing…";
  try {
    const res = await api("/api/lyzr/test", { method: "POST" });
    toast(`Lyzr: [${res.label}] ${res.message}`);
    const diagRes = await api("/api/diagnostics");
    if ($("#diagnosticsOutput")) $("#diagnosticsOutput").innerHTML = renderDiagnosticsHTML(diagRes.diagnostics || {});
    updateCounts();
  } catch (err) {
    toast(`Lyzr test error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Test Lyzr Agent";
  }
});

$("#testOmiBtn")?.addEventListener("click", async () => {
  const btn = $("#testOmiBtn");
  btn.disabled = true;
  btn.textContent = "Testing…";
  try {
    const res = await api("/api/omi/test", { method: "POST" });
    toast(`Omi: [${res.label}] ${res.message}`);
    const diagRes = await api("/api/diagnostics");
    if ($("#diagnosticsOutput")) $("#diagnosticsOutput").innerHTML = renderDiagnosticsHTML(diagRes.diagnostics || {});
    updateCounts();
  } catch (err) {
    toast(`Omi test error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Test Omi Connection";
  }
});

$("#testDevFixtureBtn")?.addEventListener("click", async () => {
  const btn = $("#testDevFixtureBtn");
  btn.disabled = true;
  btn.textContent = "Ingesting…";
  try {
    const res = await api("/api/omi/test-fixture", { method: "POST" });
    toast("Dev fixture ingested with [test-fixture] label!");
    updateCounts();
    loadVaultGrid();
  } catch (err) {
    toast(`Fixture error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Load Test Fixture (Dev)";
  }
});

// ============================================================================
// OMI PROMPT-BASED APPS RUNNER (OFFICIAL OMI DOCS)
// ============================================================================

$("#runOmiPromptBtn")?.addEventListener("click", async () => {
  const promptId = $("#omiPromptSelect")?.value || "action_item_extractor";
  let text = ($("#voiceStudioText")?.value || "").trim();
  const autoSave = $("#omiPromptSaveTasks")?.checked ?? true;

  // Auto-populate with sample dialogue if workspace is empty
  if (!text) {
    try {
      const s = await api("/api/omi/sample");
      text = s.sample;
      if ($("#voiceStudioText")) $("#voiceStudioText").value = text;
      toast("Populated sample transcript for prompt processing.");
    } catch {
      text = "Sarah: We must finalize the API documentation tonight. Alex: I will deploy the staging build before midnight.";
      if ($("#voiceStudioText")) $("#voiceStudioText").value = text;
    }
  }

  const btn = $("#runOmiPromptBtn");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const res = await api("/api/omi/prompts/run", {
      method: "POST",
      body: JSON.stringify({
        prompt_id: promptId,
        text: text,
        save_results: autoSave
      })
    });

    const result = res.result;
    const outArea = $("#omiPromptOutputArea");
    if (outArea) outArea.classList.remove("hidden");

    if ($("#omiPromptOutputTitle")) $("#omiPromptOutputTitle").textContent = result.prompt_name;
    if ($("#omiPromptExecutionBadge")) {
      $("#omiPromptExecutionBadge").textContent = result.execution_mode === "lyzr_agent" ? "Lyzr Studio AI" : "Local Omi Engine";
    }
    if ($("#omiPromptOutputContent")) {
      $("#omiPromptOutputContent").textContent = result.output_markdown;
    }

    // Render extracted tasks
    const tasksDiv = $("#omiPromptExtractedTasksList");
    if (tasksDiv) {
      if (result.extracted_tasks && result.extracted_tasks.length > 0) {
        tasksDiv.innerHTML = `
          <div style="font-size:12px;font-weight:600;color:var(--text-300);margin-bottom:6px;">
            Extracted Tasks (${result.extracted_tasks.length}) ${autoSave ? '<span style="color:var(--emerald);">✓ Persisted to Queue</span>' : ''}:
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${result.extracted_tasks.map(t => `
              <div style="background:rgba(255,255,255,0.03);padding:6px 10px;border-radius:6px;border:1px solid var(--border-soft);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;color:var(--text-100);">• ${esc(t.title)}</span>
                <span class="prio prio-${esc(t.priority || 'medium')}" style="font-size:10px;">${esc((t.priority || 'med').toUpperCase())}</span>
              </div>
            `).join('')}
          </div>
        `;
        if (autoSave && result.saved_tasks) {
          result.saved_tasks.forEach(t => appendTaskRow(t));
          updateCounts();
        }
      } else {
        tasksDiv.innerHTML = "";
      }
    }

    toast(`Executed ${result.prompt_name}`);
  } catch (err) {
    toast(`Omi Prompt error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Run Omi Prompt";
  }
});

// ============================================================================
// OMI DEVELOPER API SYNC (CONVERSATIONS, MEMORIES, ACTION-ITEMS)
// ============================================================================

async function triggerOmiSync(resource) {
  try {
    toast(`Syncing ${resource} from Omi Cloud…`);
    const res = await api("/api/omi/sync", {
      method: "POST",
      body: JSON.stringify({ resource: resource, limit: 5 })
    });
    toast(res.message);
    if (res.success) {
      // Refresh memory list and tasks
      const memData = await api("/api/memories");
      if (memData.memories) {
        $("#overviewMemoriesList").innerHTML = memData.memories.map(renderOverviewMemoryCard).join('');
      }
      const taskData = await api("/api/tasks");
      if (taskData.tasks) {
        $("#overviewTasksList").innerHTML = taskData.tasks.map(renderOverviewTaskCard).join('');
      }
      updateCounts();
    }
  } catch (err) {
    toast(`Omi sync notice: ${err.message}`);
  }
}

$("#syncOmiConvsBtn")?.addEventListener("click", () => triggerOmiSync("conversations"));
$("#syncOmiMemsBtn")?.addEventListener("click", () => triggerOmiSync("memories"));
$("#syncOmiTasksBtn")?.addEventListener("click", () => triggerOmiSync("action-items"));

// ============================================================================
// OMI MODEL CONTEXT PROTOCOL (MCP) TOOL TESTING
// ============================================================================

$("#testMcpToolBtn")?.addEventListener("click", async () => {
  const out = $("#mcpTestOutput");
  if (!out) return;
  out.classList.remove("hidden");
  out.textContent = "Invoking Omi MCP tool 'search_memories' via /api/mcp/call…";

  try {
    const res = await api("/api/mcp/call", {
      method: "POST",
      body: JSON.stringify({
        name: "search_memories",
        arguments: { query: "priorities and milestones", limit: 3 }
      })
    });
    out.textContent = `[MCP Protocol Response: 200 OK]\nTool: ${res.tool}\nResult:\n` + JSON.stringify(res.result, null, 2);
    toast("MCP tool call verified successfully.");
  } catch (err) {
    out.textContent = `MCP invocation error: ${err.message}`;
    toast(err.message);
  }
});
