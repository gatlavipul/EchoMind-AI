# EchoMind AI — Official Hackathon Demo Video Guide (Max 5 Minutes)

**Hackathon Theme**: *Stop Prompting. Code Solo Agents — The Dawn of the Autonomous AI Builder*  
**Project**: **EchoMind AI** — Voice-Powered Second Brain & Autonomous Execution Engine  
**Target Video Duration**: 4 minutes 30 seconds (Max 5 minutes)  
**Resolution**: 1080p Full HD (1920x1080) at 60 fps / 30 fps  
**Live Application URL**: `http://127.0.0.1:5000` (Local) / `https://echomind-ai.vercel.app`  
**GitHub Repository**: [https://github.com/gatlavipul/EchoMind-AI](https://github.com/gatlavipul/EchoMind-AI)

---

## 🎬 Video Production Breakdown

| Timestamp | Duration | Section | Core Focus |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | 35 sec | **1. The Hook & The Problem** | Why chat prompts fail: knowledge vanishes into ephemeral text |
| **0:35 - 1:20** | 45 sec | **2. Command Center & Capture Pipeline** | Live voice recording + Omi wearable webhook + prompt apps |
| **1:20 - 2:15** | 55 sec | **3. Memory Vault & Hybrid Retrieval** | FastEmbed vectors + SQLite lexical search + source attribution |
| **2:15 - 3:20** | 65 sec | **4. Autonomous Agent & 8-Stage Trace** | Transparent reasoning pipeline, source grounding, Lyzr audit |
| **3:20 - 4:05** | 45 sec | **5. Human-in-the-Loop Task Governance** | Approve / Edit / Dismiss proposed tasks into active Kanban |
| **4:05 - 4:35** | 30 sec | **6. System Diagnostics & Closing** | Production honesty: live health ping, zero-mock disclosure |

---

## 🎙️ Word-for-Word Script & Screenplay

### Scene 1: The Hook & The Problem (0:00 – 0:35)
- **On Screen**: EchoMind AI Command Center (`http://127.0.0.1:5000/`) with sleek dark theme, real-time metrics cards, and pulsing activity radar.
- **Visual Action**: Smooth cursor pan across the **Capture → Remember → Ask → Act** workflow banner.
- **Voiceover**:
  > *"Every day, founders and engineers engage in dozens of meetings, voice memos, and spontaneous technical brainstorms. But 90% of those commitments evaporate into thin air. Today's conversational AI forces us to constantly re-prompt, re-copy, and manually reconstruct what was said.*
  >
  > *Welcome to **EchoMind AI** — built for the HiDevs 'Stop Prompting, Code Solo Agents' Hackathon. EchoMind transforms continuous audio conversations into persistent memory, grounded reasoning, and verified action items without ever asking you to prompt again."*

---

### Scene 2: Capture — Voice Inbox & Omi Wearable Integration (0:35 – 1:20)
- **On Screen**: Click navigation tab **"Voice Inbox"** (`#voice-inbox`).
- **Visual Action**:
  1. Highlight the microphone recorder and the Omi device webhook ingestion card.
  2. Click on **"Omi Prompt-Based Apps"** modal / section showing the 3 native recipes:
     - *EchoMind Memory Extractor*
     - *Action Item Generator*
     - *Daily Briefing Synthesizer*
  3. Click **"Ingest Sample Transcript"** or trigger the test fixture. Observe the real-time toast confirmation: *"Transcript Ingested & Indexed"*.
- **Voiceover**:
  > *"Capture begins seamlessly. EchoMind supports direct web microphone recording, file uploads, and real-time webhook ingestion from Omi wearable audio hardware.*
  >
  > *Aligned with Omi's developer ecosystem, we deploy zero-server prompt apps directly into the stream — extracting structured speaker segments, high-priority deadlines, and technical decisions the second a sentence concludes.*
  >
  > *Let's ingest a multi-speaker engineering transcript. The system immediately deduplicates the raw audio, normalizes speaker turns, and commits it into our persistent memory architecture."*

---

### Scene 3: Remember — Memory Vault & Hybrid Retrieval (1:20 – 2:15)
- **On Screen**: Click navigation tab **"Memory Vault"** (`#memory-vault`).
- **Visual Action**:
  1. Show the grid of indexed memories with source badges (`omi-conversation`, `web-mic`, `test-fixture`).
  2. Type `'security'` into the search bar.
  3. Observe immediate sub-second hybrid semantic and lexical filtering.
  4. Expand a memory card to display chunk ID, metadata tags, speaker tags, and neural vector status (`BAAI/bge-small-en-v1.5`, 384 dimensions).
- **Voiceover**:
  > *"Under the hood, memory isn't just a flat database. EchoMind implements a hybrid retrieval engine combining persistent SQLite storage with vector embeddings.*
  >
  > *Every ingested conversation is chunked, timestamped, and embedded using 384-dimensional FastEmbed representations, fully compatible with Qdrant vector search collections.*
  >
  > *When I search for 'security', the engine retrieves relevant meeting context across speakers and dates in under 30 milliseconds, preserving full provenance and source attribution."*

---

### Scene 4: Ask — Autonomous Reasoning & The 8-Stage Audit Trace (2:15 – 3:20)
- **On Screen**: Click navigation tab **"Agent Workflows"** (`#agent-workflows`).
- **Visual Action**:
  1. In the Command / Query box, type:
     `"When must the security audit for EchoMind be finalized?"`
  2. Click **"Run Autonomous Agent"**.
  3. Show the loading animation as the pipeline executes.
  4. Display the synthesized, grounded answer with clear evidence citations.
  5. Scroll down to highlight the **8-Stage Transparent Execution Trace**:
     - *Stage 1: Input Received* (PASS)
     - *Stage 2: Input Normalized* (PASS)
     - *Stage 3: Memory Retrieval Attempted* (PASS)
     - *Stage 4: Retrieval Results Returned* (PASS - 5 items retrieved)
     - *Stage 5: Lyzr Agent Invoked* (SKIPPED / Local Fallback)
     - *Stage 6: Agent Response Validated* (PASS)
     - *Stage 7: Action Items Persisted* (PENDING APPROVAL)
     - *Stage 8: Memory Updates Persisted* (SKIPPED)
- **Voiceover**:
  > *"Now for the core of the solo agent architecture: the Autonomous Reasoning Pipeline. Instead of an opaque chatbot, EchoMind executes an 8-stage verifiable workflow.*
  >
  > *We query: 'When must the security audit for EchoMind be finalized?'. Notice the agent did not hallucinate. It recalled five relevant memory items from our vector vault, retrieved the exact quote from the Lead Architect, and synthesized a grounded answer.*
  >
  > *Crucially, EchoMind practices radical engineering honesty. Look at our 8-Stage Execution Trace: Stage 4 shows our exact 26-millisecond semantic retrieval. In Stage 5, our Lyzr Agent Studio connector detects whether external cloud keys are active; if absent, it gracefully activates our local deterministic planner without crashing. Every millisecond, input size, and state transition is audited and transparent."*

---

### Scene 5: Act — Human-in-the-Loop Task Governance (3:20 – 4:05)
- **On Screen**: Highlight the **"Proposed Action Items"** container, then switch to **"Action Items"** tab (`#action-items`).
- **Visual Action**:
  1. Show the proposed task: *"The security audit for EchoMind must be finalized before 11 PM tonight"* with `[HIGH]` priority tag.
  2. Click the green **"Approve"** button.
  3. Watch the toast confirm: *"Task Approved & Committed"*.
  4. Show the task appear immediately in the **Active Tasks** board.
  5. Check off a task as completed — demonstrate progress bar incrementing from 50% to 75%.
- **Voiceover**:
  > *"True autonomous agents don't just speak — they act. But autonomous action without governance is dangerous.*
  >
  > *EchoMind introduces Human-in-the-Loop Task Governance. Rather than automatically writing changes to your Jira or calendar, the agent synthesizes structured proposed actions with calculated priority.*
  >
  > *With one click on 'Approve', this task is validated, deduplicated, and committed to our persistent SQLite Action Items queue. You can also edit deadlines or dismiss noise, keeping you in complete command of your agent's autonomy."*

---

### Scene 6: Diagnostics & Wrap-up (4:05 – 4:35)
- **On Screen**: Click **"System Diagnostics"** tab (`#diagnostics`), show all green telemetry cards and run the live ping test.
- **Visual Action**:
  1. Click **"Run Live Diagnostics Ping"**.
  2. Display the instant response `<1ms` for SQLite, FastEmbed neural model status, and Omi webhook readiness.
  3. Transition back to Command Center hero screen.
- **Voiceover**:
  > *"Finally, our System Diagnostics panel gives engineers instant visibility into database latency, vector cache health, and cloud webhook availability.*
  >
  > *EchoMind AI delivers on the promise of solo agent development: turning raw audio into verifiable intelligence, traceable execution, and governed action. The entire project is open-source, fully tested with 24 automated test suites, and ready for deployment.*
  >
  > *Thank you, and enjoy exploring EchoMind AI!"*

---

## 🛠️ Step-by-Step Recording Instructions

You can record the demo using any of the following methods in 5 minutes:

### Option A: Using Windows Game Bar / Snipping Tool (Easiest & Free)
1. Ensure your Flask server is running:
   ```powershell
   cd d:\EchoMind_AI_Hackathon_Starter
   .\.venv\Scripts\python.exe app.py
   ```
2. Open Chrome or Edge and go to `http://127.0.0.1:5000/`.
3. Press **Windows Key + Alt + R** to start screen recording (or use Windows Snipping Tool **Win + Shift + S** -> Video Mode).
4. Follow the 6 scenes outlined in the script above. Speak along or record voiceover after.
5. Press **Windows Key + Alt + R** to stop recording. The MP4 video will be saved in your `Videos\Captures` folder.

### Option B: Using Loom (Recommended for Hackathons)
1. Open [loom.com](https://www.loom.com).
2. Select **Screen + Camera** (or Screen only) and set mic input.
3. Record the 4m 30s walkthrough following the exact script.
4. Loom automatically generates a shareable public link ready to paste directly into the hackathon submission form!

---

## 📋 Hackathon Submission Checklist

- **Project Name**: EchoMind AI
- **Tagline**: Voice-Powered Second Brain & Verifiable Autonomous Execution Engine
- **GitHub Repository**: `https://github.com/gatlavipul/EchoMind-AI`
- **Demo Video URL**: `<Your YouTube or Loom URL>`
- **Live Deployed URL**: `https://echomind-ai.vercel.app` (or Vercel link generated via repository import)
- **Core Integrations**:
  - **Omi**: Webhook audio ingestion + prompt-based app recipes
  - **Qdrant**: 384-dimensional FastEmbed vector search collection
  - **Lyzr**: Agent Studio execution trace and local deterministic planning
