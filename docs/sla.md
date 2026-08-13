# Service Level Agreements (SLAs)

This document establishes the service levels, response latency targets, and client hardware assumptions for the production deployment of The Token Cosmos.

---

## 1. System Availability Commitment

We guarantee a **99.9% Monthly Uptime** for the hosted application endpoint.

- **Uptime Metric**: Successful HTTP responses (`200 OK`) on `/api/health` and `/` endpoints.
- **Exclusions**: Outages caused by global GCP regions going offline, DNS routing issues outside our control, or client-side browser crashes.

---

## 2. Latency Targets

We structure our performance requirements across server-side and client-side processing boundaries:

| Layer | Operation | Latency SLA (p50) | Latency SLA (p95) | Latency SLA (p99) |
| :--- | :--- | :--- | :--- | :--- |
| **Server-side API** | `POST /api/logits` (Synthetic Engine) | <20ms | <50ms | <100ms |
| **Server-side API** | `POST /api/logits` (Llama.cpp CPU Engine) | <150ms | <250ms | <400ms |
| **Edge WebGPU** | Token generation step (Local model run) | <30ms | <60ms | <120ms |
| **Client UI** | Probability recalculation on slider drag | <16ms (60 FPS) | <25ms | <33ms (30 FPS) |

### Cold-Start Latency
Because Google Cloud Run scales to zero instances when idle, the first request after a period of inactivity will trigger a container cold start.
- **Cold-Start SLA**: Container initialization and HTTP response must complete in **<2.5 seconds**. This is achieved by allocating `--cpu-boost` and keeping the Docker layer thin.

---

## 3. Client Hardware Requirements & Browser Support

Because The Token Cosmos utilizes bleeding-edge browser APIs for local AI inference, users must meet these minimum client-side capabilities for the local WebGPU engine:

### Browser Support Matrix
- **WebGPU Mode**: Chrome 113+, Microsoft Edge 113+, Safari 18+, Opera 100+.
- **WASM Mode (Fallback)**: Chrome 95+, Safari 15+, Firefox 90+, Edge 95+.

### Hardware Resource Allocation
To prevent crashes and Out-of-Memory exceptions, client devices should align with the following hardware profiles based on the model loaded:

| Model ID | Required VRAM | Recommended RAM | Minimum CPU |
| :--- | :--- | :--- | :--- |
| **SmolLM2 135M** | ~180MB | 4GB | Dual-Core Intel/ARM |
| **Qwen2.5 0.5B** | ~500MB | 8GB | Quad-Core Intel/AMD/M1 |
| **Qwen2.5 1.5B** | ~1.2GB | 16GB | Apple Silicon or Dedicated GPU |
