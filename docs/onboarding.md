# Developer Onboarding & Setup

This guide walks a new engineer through cloning the repository, installing dependencies, and running a local development environment for both the frontend React application and the FastAPI backend.

---

## 1. Getting Started

### Clone the Repository
Clone the codebase to your local workstation:
```bash
git clone https://github.com/organization/the-token-cosmos.git
cd the-token-cosmos
```

---

## 2. Frontend Development Setup

The frontend is built using **React, TypeScript, and Vite**.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm ci
   ```
   > [!NOTE]
   > We use `npm ci` instead of `npm install` to ensure that packages align exactly with the `package-lock.json` file.
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the UI: Open [http://localhost:3000](http://localhost:3000) in your browser.
   - Vite is configured to proxy all `/api/*` traffic to the backend running at `http://localhost:8000`.

---

## 3. Backend Development Setup

The backend is built with **FastAPI** and uses **Uvicorn** as the ASGI server.

1. Navigate to the backend directory:
   ```bash
   cd ../backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Upgrade pip and install dependencies:
   ```bash
   python -m pip install --upgrade pip
   python -m pip install -r requirements.txt
   ```
4. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
5. Access the API health check: Open [http://localhost:8000/api/health](http://localhost:8000/api/health) in your browser.

---

## 4. Configuring a Real LLM (Optional GGUF Mode)

By default, if no model file is found at the target path, the backend runs in `synthetic-cosmos-engine` mode and generates mock logits based on prompt keywords. To run local CPU inference using a real LLM:

1. Download a GGUF format model (e.g., `qwen2.5-0.5b-instruct-q4_k_m.gguf` from Hugging Face).
2. Create a models directory:
   ```bash
   mkdir -p backend/models
   ```
3. Move the downloaded GGUF file to `backend/models/qwen2.5-0.5b-instruct-q4_k_m.gguf`.
4. Run the FastAPI server. It will detect the file and load the GGUF model via llama.cpp.
   - Alternatively, you can override the path using the `MODEL_PATH` environment variable:
     ```bash
     export MODEL_PATH=/absolute/path/to/model.gguf
     ```

---

## 5. Running Automated Tests

Before pushing code changes to your branch, verify that the backend tests pass successfully:

```bash
cd backend
python -m unittest discover -s . -p 'test_*.py'
```
The CI/CD pipeline runs this exact command on every pull request.
