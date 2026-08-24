# 🌌 The Token Cosmos — Interactive LLM Probability Visualizer & Educational Guide

[![Documentation Status](https://img.shields.io/badge/docs-GitHub_Pages-blueviolet.svg)](https://lolet.github.io/the-token-cosmos/)

**"The Token Cosmos"** is a full-stack, responsive web application and educational guide built to teach everyday AI users how LLM sampling parameters (Temperature, Top-K, Top-P, Min-P, Penalties, Logit Bias) and Retrieval-Augmented Generation (RAG) mathematically shape AI token generation.

For repository ownership, deployment boundaries, and the status of supporting
tools, read the [repository map](docs/repository_map.md).


---

## 1. System Architecture & $0.00 Idle Cost Design

```
+-----------------------------------------------------------------------------------+
|               FRONTEND: "THE TOKEN COSMOS" (React + TypeScript + Tailwind)        |
|  - 2D HTML5 Canvas Starfield Visualizer & Constellation Flight Path Timeline     |
|  - 100% Client-Side Math Pipeline (Log-Sum-Exp Softmax, Temp, Top-K, Top-P, Min-P)|
|  - 60 FPS Real-Time UI updates with ZERO backend API re-fetches during slider drag |
+-----------------------------------------------------------------------------------+
                                         |
                       (1 HTTP Request per Prompt / Step)
                                         v
+-----------------------------------------------------------------------------------+
|             CLOUD RUN: FastAPI API + COMPILED REACT SPA (one container)           |
|  - Min-instances: 0 (Scales to $0.00 cost when idle)                              |
|  - Serves POST /api/logits returning raw candidate logits                         |
|  - Uses a local GGUF model only when one is explicitly mounted at MODEL_PATH       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Visual Metaphor

- **Tokens = Celestial Bodies**: High-probability tokens (&gt;40%) are glowing center supergiants; low-probability tokens (&lt;1%) are dim outer asteroids.
- **RAG Grounding = Fact Anchors**: Retrieved factual context pulls candidates to the center connected by glowing cyan laser lines.
- **Generation = Constellation Flight Path**: Sentence generation forms an interactive step-by-step flight trajectory across space.

---

## 3. Mathematical Pipeline (`samplingMath.ts`)

The client math pipeline executes in browser memory at 60 FPS without API re-fetches:

1. **Logit Bias & Penalties**:
   $$z_i' = z_i + \text{bias}_i - (\text{presence\_penalty} \times p(x_i) + \text{frequency\_penalty} \times c(x_i))$$
2. **Numerically Stable Softmax (Log-Sum-Exp Trick)**:
   $$P(x_i) = \frac{\exp\left(\frac{z_i - z_{\max}}{T}\right)}{\sum_j \exp\left(\frac{z_j - z_{\max}}{T}\right)}$$
3. **Greedy Fallback**: Bypasses softmax when $T \le 0.01$, setting top token probability to `100.0%` (`1.0`).
4. **Top-K, Top-P, Min-P Filters**: Filters candidate tokens by rank index $K$, cumulative probability $P$, and relative max probability threshold $min\_p \times P_{\max}$.

---

## 4. Local Development Setup

### Frontend Setup (React + Vite)
```bash
cd frontend
npm ci
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Vite proxies `/api` requests to the backend at port `8000`.

### Backend Setup (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Serves [http://localhost:8000](http://localhost:8000) (`POST /api/logits`).

Without a GGUF file at `backend/models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (or a
`MODEL_PATH` override), the API intentionally reports `synthetic-cosmos-engine` and
returns prompt- and RAG-aware demonstration candidates. The UI labels this source
instead of presenting it as a deployed Qwen model.

---

## 5. Production Cloud Run Deployment

The root `Dockerfile` builds the frontend and serves it with the FastAPI API from one
Cloud Run container. Test that production shape locally with Docker:

```bash
docker build -t the-token-cosmos .
docker run --rm -p 8080:8080 the-token-cosmos
```

Open [http://localhost:8080](http://localhost:8080) and check
`http://localhost:8080/api/health`.

This root Dockerfile is the only supported production image. The component
Dockerfiles and Nginx files are retained for experiments and are not deployment
instructions.

### GitHub Actions deployment

The workflow always builds the frontend and runs backend tests. It deploys only after
these repository variables are configured:

```text
GCP_PROJECT_ID=<your-project-id>
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>
GCP_SERVICE_ACCOUNT=<deployer-service-account>@<your-project-id>.iam.gserviceaccount.com
```

Configure a GitHub OIDC Workload Identity Provider that trusts this repository and
grant the service account permission to push to Artifact Registry and deploy Cloud
Run services. Create the configured Artifact Registry repository before the first
deployment:

```bash
gcloud artifacts repositories create cosmos-repo \
  --repository-format=docker \
  --location=us-central1 \
  --project=<your-project-id>
```

Once those variables and cloud permissions exist, a push to `main` or `master` builds
and deploys the root image:

```bash
gcloud run deploy the-token-cosmos \
  --image us-central1-docker.pkg.dev/<your-project-id>/cosmos-repo/the-token-cosmos:<image-tag> \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --cpu-boost
```
