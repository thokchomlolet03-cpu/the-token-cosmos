import os
import time
import math
import random
import re
from typing import List, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="The Token Cosmos API",
    description="FastAPI Backend for raw LLM candidate logits with System Override & BYOE support",
    version="2.0.0",
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_browser_isolation_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
    return response

# Pydantic Schemas
class LogitRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    rag_context: Optional[str] = None
    top_n: int = Field(default=50, ge=1, le=200)

class TokenCandidate(BaseModel):
    token_id: int
    token_str: str
    raw_logit: float
    is_rag_grounded: bool = False

class LogitResponse(BaseModel):
    candidates: List[TokenCandidate]
    prompt: str
    system_prompt: Optional[str] = None
    rag_enabled: bool
    engine: str
    processing_time_ms: float

# Optional llama.cpp initialization
LLAMA_MODEL = None
MODEL_PATH = os.getenv(
    "MODEL_PATH",
    str(Path(__file__).parent / "models" / "qwen2.5-0.5b-instruct-q4_k_m.gguf"),
)

if os.path.exists(MODEL_PATH) and os.getenv("SKIP_MODEL_LOAD") != "true":
    try:
        from llama_cpp import Llama
        print(f"Loading GGUF model from {MODEL_PATH}...")
        LLAMA_MODEL = Llama(
            model_path=MODEL_PATH,
            logits_all=True,
            n_ctx=2048,
            verbose=False,
        )
        print("GGUF model loaded successfully!")
    except Exception as e:
        print(f"Failed to load llama-cpp model ({e}). Falling back to synthetic logit engine.")

@app.get("/")
def read_root():
    # Serve React SPA if frontend dist is available (production Cloud Run)
    static_index = Path(__file__).parent / "static" / "index.html"
    if static_index.exists():
        return FileResponse(str(static_index))
    # Otherwise return API status JSON (local backend-only development)
    return {
        "status": "online",
        "app": "The Token Cosmos API",
        "engine": "llama-cpp" if LLAMA_MODEL else "synthetic-cosmos-engine",
    }

@app.get("/api/health")
def api_health():
    return {
        "status": "online",
        "app": "The Token Cosmos API",
        "engine": "llama-cpp" if LLAMA_MODEL else "synthetic-cosmos-engine",
    }


def _candidate_words(prompt: str, rag_context: Optional[str], system_prompt: Optional[str]) -> List[str]:
    if system_prompt and ("sql" in system_prompt.lower() or "dba" in system_prompt.lower()):
        return [" SELECT", " FROM", " WHERE", " JOIN", " GROUP", " BY", " ORDER", " LIMIT", " COUNT", " MAX"]

    source_text = " ".join(part for part in [rag_context or "", prompt] if part)
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", source_text)
    unique_words: List[str] = []
    seen = set()
    for word in words:
        normalized = word.lower()
        if len(normalized) < 3 or normalized in seen:
            continue
        seen.add(normalized)
        unique_words.append(f" {word}")

    return unique_words or [
        " answer", " analysis", " context", " result", " response", " detail",
        " explanation", " model", " token", " probability",
    ]

@app.post("/api/logits", response_model=LogitResponse)
def get_logits(req: LogitRequest):
    start_time = time.time()
    prompt = req.prompt or "What is the capital of France?"
    system_prompt = req.system_prompt
    rag_context = req.rag_context
    top_n = req.top_n
    rag_enabled = bool(rag_context and rag_context.strip())

    candidates: List[TokenCandidate] = []
    engine_used = "synthetic-cosmos-engine"

    if LLAMA_MODEL is not None:
        try:
            engine_used = "llama-cpp-qwen2.5"
            full_prompt = ""
            if system_prompt and system_prompt.strip():
                full_prompt += f"<|im_start|>system\n{system_prompt.strip()}<|im_end|>\n"
            
            if rag_enabled:
                full_prompt += f"<|im_start|>user\nContext: {rag_context}\n\nQuestion: {prompt}<|im_end|>\n<|im_start|>assistant\n"
            else:
                full_prompt += f"<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n"

            # Extract raw logits using llama.cpp
            tokens = LLAMA_MODEL.tokenize(full_prompt.encode('utf-8'))
            LLAMA_MODEL.eval(tokens)
            logits = LLAMA_MODEL._scores[-1] # logits for next token
            
            # Sort top N indices
            sorted_indices = sorted(range(len(logits)), key=lambda i: logits[i], reverse=True)[:top_n]
            
            for rank, idx in enumerate(sorted_indices):
                token_bytes = LLAMA_MODEL.detokenize([idx])
                token_str = token_bytes.decode('utf-8', errors='ignore')
                raw_logit = float(logits[idx])
                
                # Check RAG grounding
                is_grounded = False
                if rag_enabled and rag_context:
                    clean_str = token_str.strip().lower()
                    if len(clean_str) > 2 and clean_str in rag_context.lower():
                        is_grounded = True

                candidates.append(TokenCandidate(
                    token_id=idx,
                    token_str=token_str if token_str else f"token_{idx}",
                    raw_logit=raw_logit,
                    is_rag_grounded=is_grounded,
                ))
        except Exception as e:
            print(f"llama-cpp inference error: {e}. Falling back to synthetic engine.")
            candidates = []

    # High-performance synthetic logit generator fallback
    if not candidates:
        engine_used = "synthetic-cosmos-engine"

        # Deterministic seed from system_prompt + prompt text
        seed_str = (system_prompt or "") + prompt
        seed = sum(ord(c) for c in seed_str)
        random.seed(seed)

        base_words = _candidate_words(prompt, rag_context, system_prompt)

        # Extract keywords from RAG context for grounding
        rag_keywords = []
        if rag_enabled and rag_context:
            rag_keywords = [w.strip() for w in rag_context.split() if len(w.strip()) > 3]

        for i in range(top_n):
            if i < len(base_words):
                w = base_words[i]
            else:
                w = f" token_{i+1}"

            # High logits for rank 1-5, decreasing logit curve
            raw_logit = 16.0 - math.log(i + 1) * 3.2 + (random.random() * 0.8)  # nosec B311

            # RAG grounding boost & boolean flag
            is_grounded = False
            if rag_enabled and rag_keywords:
                clean_w = w.strip().lower()
                for kw in rag_keywords:
                    if clean_w in kw.lower() or kw.lower() in clean_w:
                        is_grounded = True
                        raw_logit += 4.5 # Boost logit score for grounded tokens
                        break

            candidates.append(TokenCandidate(
                token_id=1000 + i,
                token_str=w,
                raw_logit=round(raw_logit, 2),
                is_rag_grounded=is_grounded,
            ))

    # Sort descending by raw_logit
    candidates.sort(key=lambda c: c.raw_logit, reverse=True)

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    return LogitResponse(
        candidates=candidates[:top_n],
        prompt=prompt,
        system_prompt=system_prompt,
        rag_enabled=rag_enabled,
        engine=engine_used,
        processing_time_ms=elapsed_ms,
    )

# Mount frontend static dist directory for unified Cloud Run deployment
# This allows serving both API and React SPA from a single container ($0.00 idle)
STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # SPA catch-all: serve index.html for all non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        # Check if the requested file exists in static directory
        file_path = STATIC_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html for SPA client-side routing
        return FileResponse(str(STATIC_DIR / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)  # nosec B104
