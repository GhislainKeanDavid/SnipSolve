# SnipSolve Refactor - Progress Tracker (Ralph Loop)

> **Last Updated:** Session resumed after token limit crash
> **Current Focus:** Task 1 - Local LLM Migration

---

## Task Status

| Task | Description | Status |
|------|-------------|--------|
| **Task 1** | Brain (Cloud LLM → Bundled Local LLM) | `[DONE]` ✅ |
| **Task 2** | Eyes (Tesseract → OS Native OCR) | `[TODO]` |
| **Task 3** | Search (Keyword → Vector RAG) | `[TODO]` |
| **Task 4** | Security (Plain Text → Encrypted) | `[TODO]` |

---

## Task 1: Local LLM Migration - Detailed Status

### Dependencies
- [x] `node-llama-cpp@3.1.1` installed
- [x] `node-fetch@2.7.0` installed

### Files Created
- [x] `src/main/services/ModelManager.ts` - Model download & management
- [x] `src/main/services/AIService.ts` - OpenAI-compatible interface

### Integration Points
- [x] `main.ts` - initializePhase3() calls ModelManager/AIService
- [x] `main.ts` - generateSolution() uses aiService
- [x] `main.ts` - generateChatTitle() uses aiService
- [x] `main.ts` - chat-followup handler uses aiService
- [x] `main.ts` - IPC handlers for get-model-status, download-model
- [x] `preload.ts` - Model IPC methods exposed to renderer
- [x] `preload.ts` - AI status listeners added

### Verification ✅
- [x] TypeScript compilation passes (lint warnings only, no errors)
- [x] Tests pass (12/12)
- [x] Vite build succeeds (main.js: 438KB, preload.js: 1.8KB, renderer: 234KB)

### Bug Fixes Applied (Session 2)
- [x] ModelManager: Added file size validation to detect incomplete downloads
- [x] ModelManager: Auto-deletes corrupted/incomplete model files
- [x] Shortcut: Changed default to `CommandOrControl+Alt+S` (less conflicts)
- [x] Shortcut: Added fallback mechanism - tries multiple shortcuts if primary fails
- [x] Settings: Auto-saves working shortcut when fallback is used
- [x] ModelManager: Fixed download using createWriteStream with backpressure handling
- [x] ModelManager: Fixed file not being properly flushed to disk (await finish event)

---

## Notes

### Session Recovery (Current)
This session is resuming from a previous token-limit crash. The previous session created the Task 1 implementation files, but we need to verify:
1. Code compiles without errors
2. Tests still pass
3. No missing pieces

---

## Architecture Reference

### Target Model
- **Model:** Gemma 2 2B Instruct
- **Quantization:** Q4_K_M (~1.6GB)
- **Storage:** `~/.snipsolve/models/`
- **Source:** HuggingFace (bartowski/gemma-2-2b-it-GGUF)
- **Improvements over Phi-3:** 2x larger context (8K vs 4K), better RAG accuracy, 2-3x faster inference, lower memory usage

### Download Workflow
1. App starts → `initializePhase3()` called
2. `ModelManager.isModelAvailable()` checks for .gguf
3. If missing → `downloadModel()` with progress events
4. `AIService.initialize()` loads model into RAM
5. AI ready for chat completions
