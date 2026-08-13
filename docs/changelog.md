# Release Versioning & Changelog

All notable changes to **The Token Cosmos** project are documented on this page under the **Semantic Versioning** rules (`MAJOR.MINOR.PATCH`).

---

## [v4.1.0] - 2026-08-13 (Current Release)

This release implements real-time streaming optimizations and formalizes repository governance, security audits, and developer automation.

### Added
- **Token Streaming Optimizations**: Added real-time token streaming support to the WebGPU inference worker, rendering tokens dynamically in the flight path at 60 FPS.
- **Reasoning Model Support**: Implemented parsing for `<think>` tag blocks, isolating the reasoning process visually on the canvas (represented as distinct asteroid-like thinking states) and formatting thoughts in a separate UI panel.
- **Friction Hunter & BigQuery Ingestion**: Deployed the automated Friction Hunter diagnostics pipeline (August 2026) to calculate probability drops between phrases and stream telemetry logs directly into day-partitioned GCP BigQuery tables (`cosmos_telemetry.friction_points`).
- **Automated Pre-Commit Hooks**: Added local git pre-commit link-checking hooks.
- **SAST Security Scanning**: Integrated Bandit static security scanning into CI/CD pipelines to audit python dependencies and code files.

---

## [v4.0.0] - 2026-08-12 (Major Release)

### Added
- **Edge-AI Inference**: Integrated `@mlc-ai/web-llm` into a background WebWorker (`WebGPUInferenceWorker.ts`) to run SmolLM2 and Qwen2.5 local inference in browser memory.
- **3D Semantic Terrain**: Created `TerrainCanvas.tsx` to visualize vocabulary semantic layouts using precomputed UMAP 2D coordinates and logit Z-axis heights.
- **Min-P Sampling Filter**: Added relative probability thresholding to the core math pipeline.
- **Auto-Sync API Documentation**: Added a Python generator script to extract endpoints directly from FastAPI and output them to Markdown format.
- **Documentation Linting**: Added a link-validation test script to ensure document integrity before committing.

### Changed
- **Deployment Strategy**: Replaced separate frontend and backend hosting with a unified multi-stage Docker build, serving the React SPA directly from FastAPI on port 8080.
- **Zero Idle Costs**: Set GCP Cloud Run auto-scaling parameters to scale to zero instances when idle.

---

## [v3.0.0] - 2026-02-10

This release improved visual representations and introduced core parameter modifications.

### Added
- **2D Starfield Visualizer**: Developed particle starfield canvas representing tokens as celestial bodies (Supergiants vs Asteroids).
- **RAG Grounding Indicators**: Added cyan laser vector highlights connecting prompt context tokens to orbit centers.
- **Logit Biasing**: Introduced logit bias sliders allowing users to manually increase/decrease selection weights of target words.

### Changed
- **Softmax Stability**: Implemented the Numerically Stable Softmax pipeline using the Log-Sum-Exp mathematical trick to prevent client browser overflows.

---

## [v2.0.0] - 2025-09-05

This version migrated the codebase from a Python command-line utility to a reactive web application.

### Added
- **React Frontend**: Developed modular user interface using Vite, Tailwind CSS, and TypeScript.
- **FastAPI API**: Implemented FastAPI backend server with JSON-schema validators for raw candidate logit retrieval.

---

## [v1.0.0] - 2025-03-01

### Added
- **Initial Release**: Basic command-line sampler simulation in Python showing how Temperature and Top-K filter probability arrays.
