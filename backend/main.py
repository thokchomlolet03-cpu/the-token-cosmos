import os
import time
import math
import random
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="The Token Cosmos API",
    description="FastAPI Backend for raw LLM candidate logits with System Override & BYOE support",
    version="2.0.0",
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class LogitRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None
    rag_context: Optional[str] = None
    top_n: Optional[int] = 50

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
MODEL_PATH = os.getenv("MODEL_PATH", "models/qwen2.5-0.5b-instruct-q4_k_m.gguf")

if os.path.exists(MODEL_PATH):
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
    return {
        "status": "online",
        "app": "The Token Cosmos API",
        "engine": "llama-cpp" if LLAMA_MODEL else "synthetic-cosmos-engine",
    }

@app.post("/api/logits", response_model=LogitResponse)
def get_logits(req: LogitRequest):
    start_time = time.time()
    prompt = req.prompt or "What is the capital of France?"
    system_prompt = req.system_prompt
    rag_context = req.rag_context
    top_n = req.top_n or 50
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

        # Baseline common English words / candidates
        base_words = [
            " Paris", " France", " Eiffel", " Tower", " capital", " city", " population",
            " historic", " famous", " European", " London", " Berlin", " Rome", " Madrid",
            " Tokyo", " Washington", " vibrant", " beautiful", " located", " country",
            " landmark", " museum", " cultural", " center", " region", " tourism"
        ]

        if system_prompt and ("sql" in system_prompt.lower() or "dba" in system_prompt.lower()):
            base_words = [" SELECT", " FROM", " WHERE", " JOIN", " GROUP", " BY", " ORDER", " LIMIT", " COUNT", " MAX"]

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
            raw_logit = 16.0 - math.log(i + 1) * 3.2 + (random.random() * 0.8)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
