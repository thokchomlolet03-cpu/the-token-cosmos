# Testing Strategy Guide

This guide describes the testing strategy, mocking protocols, and verification commands used to validate the stability of both the frontend UI and the backend API gateway.

---

## 1. Backend Testing (FastAPI)

The backend test suite is written using Python's standard `unittest` library and is executed in both the pre-commit stage and the CI/CD pipeline.

### Test Structure (`backend/test_main.py`)
The tests focus on API contract validation, request payload constraints, and RAG grounding logic:
- **Health Verification**: Ensures `/api/health` reports status `online` and identifies the engine used.
- **Logit Constraints**: Verifies that requests for `top_n` tokens return exactly `top_n` candidate models and that candidate lists are sorted in descending logit order.
- **RAG Grounding Flag**: Asserts that when `rag_context` is provided, candidate words that match the context keywords are flagged as `is_rag_grounded = True`.

### Mocking LLM Models during Testing
To prevent the test runner from downloading or loading 500MB GGUF models (which would crash CI and slow down local tests):
- We run the test suite with `SKIP_MODEL_LOAD=true`.
- The backend main code automatically falls back to the **Synthetic Logit Generator Engine** when this flag is active.
- The synthetic engine provides prompt-aware, deterministic logit scores which simulate the formatting of raw llama.cpp outputs, allowing full API contract testing without AI model memory overhead.

---

## 2. Frontend Testing (React & Canvas)

Testing edge-AI models and WebGL/WebGPU canvas nodes requires custom mock boundaries because hardware and browser drivers are typically absent in virtual headless environments.

### Mocking the WebGPU Inference Worker
When running unit tests for React hooks (e.g. using Vitest and React Testing Library), we mock the WebWorker interface (`WebGPUInferenceWorker.ts`) so we do not attempt to load WebGPU drivers:

```typescript
// Example: Mock WebWorker interface in test setup
class MockWorker {
  onmessage: (e: any) => void = () => {};
  
  postMessage(message: any) {
    // Simulate WorkerOutbound message events returning states
    if (message.type === 'LOAD_MODEL') {
      this.onmessage({ data: { type: 'STATUS', status: 'downloading', progress: 50, text: 'Downloading...' } });
      setTimeout(() => {
        this.onmessage({ data: { type: 'MODEL_LOADED', modelId: message.modelId, vocabSize: 32000 } });
      }, 50);
    }
  }
}
global.Worker = MockWorker as any;
```

### WebGL & Canvas E2E Testing (Playwright)
To verify that the 3D particle terrain and 2D starfields render without crashing WebGL contexts:
1. We implement **Playwright E2E tests** configured to launch Chromium with hardware acceleration and WebGPU flags enabled:
   ```javascript
   // playwright.config.ts
   use: {
     launchOptions: {
       args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader']
     }
   }
   ```
2. The tests navigate to the canvas pages, verify that the canvas element exists in the DOM, and assert that no JavaScript context errors or `WebGL Context Lost` warnings are logged in the browser console.

---

## 3. Execution Commands

### Run Backend Tests
Run the Python test suite from the repository root or backend folder:
```bash
cd backend
python -m unittest discover -s . -p 'test_*.py'
```

### Run Security Audits
Validate Python backend security structure:
```bash
bandit -r backend/
```
