# 🌌 The Token Cosmos — Interactive LLM Probability Visualizer & Educational Guide

**"The Token Cosmos"** is a full-stack, responsive web application and educational guide built to teach everyday AI users how LLM sampling parameters (Temperature, Top-K, Top-P, Min-P, Penalties, Logit Bias) and Retrieval-Augmented Generation (RAG) mathematically shape AI token generation.

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
|              BACKEND: GOOGLE CLOUD RUN CPU (FastAPI + llama-cpp-python)           |
|  - Min-instances: 0 (Scales to $0.00 cost when idle)                              |
|  - Serves POST /api/logits returning raw candidate logits                         |
|  - Enabled with GCP Cloud Run `--cpu-boost` for instant cold-start model load      |
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
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Backend Setup (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python main.py
```
Serves [http://localhost:8000](http://localhost:8000) (`POST /api/logits`).

---

## 5. Production Cloud Run Deployment

Deploy to Google Cloud Run with `$0.00` idle cost and cold start acceleration:

```bash
gcloud run deploy the-token-cosmos \
  --source ./backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 80 \
  --cpu-boost
```
