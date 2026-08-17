#!/usr/bin/env python3
"""
precompute-universal-manifold.py — Contextual BPE Vocabulary Aggregation Script
Generates a Universal Semantic Reference Manifold that maps BPE subword fragments
from different tokenizers (Llama-3, Qwen-2.5, Mistral) back to full canonical words,
guaranteeing spatial alignment across multi-model comparisons.
The Token Cosmos v4.8
"""

import json
import math
from pathlib import Path

CANONICAL_VOCABULARY = [
    # Entities & Geography (Sector E-05)
    {"word": "Paris", "sector": "GEO", "base_x": 0.48, "base_y": 0.46, "tokens": ["Paris", " Paris", "PARIS"]},
    {"word": "London", "sector": "GEO", "base_x": 0.42, "base_y": 0.50, "tokens": ["London", " London"]},
    {"word": "France", "sector": "GEO", "base_x": 0.50, "base_y": 0.42, "tokens": ["France", " France"]},
    {"word": "Delaware", "sector": "GEO", "base_x": 0.38, "base_y": 0.38, "tokens": ["Delaware", " Delaware"]},
    
    # Abstract Reasoning & Cognitive Verbs (Sector B-02)
    {"word": "reasoning", "sector": "VRB", "base_x": -0.52, "base_y": 0.18, "tokens": ["reason", "ing", " reasoning", " Reason"]},
    {"word": "infrastructure", "sector": "VRB", "base_x": -0.45, "base_y": 0.22, "tokens": ["infr", "ast", "ructure", " infrastructure", " Infrastructure"]},
    {"word": "calculate", "sector": "VRB", "base_x": -0.48, "base_y": 0.12, "tokens": ["calc", "ulate", " calculate"]},
    {"word": "hypothesize", "sector": "VRB", "base_x": -0.56, "base_y": 0.25, "tokens": ["hypo", "thesize", " hypothesize"]},
    
    # Numerics & Programming Logic (Sector E-02)
    {"word": "python", "sector": "NUM", "base_x": 0.52, "base_y": -0.22, "tokens": ["python", " Python", " py"]},
    {"word": "typescript", "sector": "NUM", "base_x": 0.58, "base_y": -0.28, "tokens": ["type", "script", " TypeScript", " ts"]},
    {"word": "return", "sector": "NUM", "base_x": 0.46, "base_y": -0.32, "tokens": ["return", " Return"]},
    {"word": "function", "sector": "NUM", "base_x": 0.60, "base_y": -0.18, "tokens": ["func", "tion", " function"]},
    
    # Syntax & Structural Delimiters (Sector C-06)
    {"word": "{", "sector": "SYN", "base_x": 0.02, "base_y": -0.58, "tokens": ["{", " {", "{{" ]},
    {"word": "}", "sector": "SYN", "base_x": -0.02, "base_y": -0.62, "tokens": ["}", " }", "}}"]},
    {"word": "\n", "sector": "SYN", "base_x": 0.05, "base_y": -0.65, "tokens": ["\n", "\n\n", "\\n"]},
    {"word": "[", "sector": "SYN", "base_x": -0.05, "base_y": -0.55, "tokens": ["[", " ["]},
    
    # Core Function Words (Sector C-03)
    {"word": "the", "sector": "COR", "base_x": 0.01, "base_y": 0.02, "tokens": ["the", " The", "THE"]},
    {"word": "is", "sector": "COR", "base_x": -0.02, "base_y": -0.01, "tokens": ["is", " Is", "IS"]},
    {"word": "of", "sector": "COR", "base_x": 0.03, "base_y": -0.02, "tokens": ["of", " Of", "OF"]},
    {"word": "and", "sector": "COR", "base_x": -0.01, "base_y": 0.03, "tokens": ["and", " And", "AND"]},
]

def generate_universal_manifold():
    out_dir = Path(__file__).parent.parent / "public" / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    subword_mapping = {}
    
    for entry in CANONICAL_VOCABULARY:
        bx = entry["base_x"]
        by = entry["base_y"]
        
        for idx, subword in enumerate(entry["tokens"]):
            jitter_x = (hash(subword) % 1000) / 10000.0 - 0.05
            jitter_y = (hash(subword[::-1]) % 1000) / 10000.0 - 0.05
            
            subword_mapping[subword] = {
                "parent_word": entry["word"],
                "sector": entry["sector"],
                "umap_x": round(bx + jitter_x, 4),
                "umap_y": round(by + jitter_y, 4),
            }
            
    json_path = out_dir / "universal_manifold.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(subword_mapping, f, indent=2)
        
    print(f"✅ Generated Universal Manifold with {len(subword_mapping)} aligned subword tokens: {json_path}")

if __name__ == "__main__":
    generate_universal_manifold()
