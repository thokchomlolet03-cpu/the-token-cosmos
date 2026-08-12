#!/usr/bin/env python3
"""
Pre-compute UMAP 2D coordinates from an LLM's embedding matrix.
Outputs a binary file of interleaved Float32 [x0, y0, x1, y1, ...] coordinates.

Usage:
    pip install torch transformers umap-learn numpy
    python precompute-umap.py --model HuggingFaceTB/SmolLM2-135M-Instruct --output ../public/terrain/smollm2-135m-umap.bin
    python precompute-umap.py --model Qwen/Qwen2.5-0.5B-Instruct --output ../public/terrain/qwen2.5-0.5b-umap.bin

The Token Cosmos v4.0 — Offline Pipeline
"""

import argparse
import struct
import numpy as np

def main():
    parser = argparse.ArgumentParser(description='Pre-compute UMAP coordinates from LLM embeddings')
    parser.add_argument('--model', type=str, required=True, help='HuggingFace model ID')
    parser.add_argument('--output', type=str, required=True, help='Output binary file path')
    parser.add_argument('--n-neighbors', type=int, default=15, help='UMAP n_neighbors')
    parser.add_argument('--min-dist', type=float, default=0.1, help='UMAP min_dist')
    parser.add_argument('--n-epochs', type=int, default=500, help='UMAP n_epochs')
    parser.add_argument('--metric', type=str, default='cosine', help='Distance metric')
    parser.add_argument('--pca-dim', type=int, default=50, help='Pre-reduce to this dim with PCA before UMAP (0=skip)')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    args = parser.parse_args()

    print(f"[1/4] Loading model embeddings from: {args.model}")

    try:
        import torch
        from transformers import AutoModel, AutoTokenizer
    except ImportError:
        print("ERROR: Install dependencies: pip install torch transformers umap-learn numpy")
        return

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    model = AutoModel.from_pretrained(args.model, trust_remote_code=True, torch_dtype=torch.float32)

    # Extract embedding matrix
    embed_weight = None
    if hasattr(model, 'embed_tokens'):
        embed_weight = model.embed_tokens.weight
    elif hasattr(model, 'model') and hasattr(model.model, 'embed_tokens'):
        embed_weight = model.model.embed_tokens.weight
    elif hasattr(model, 'get_input_embeddings'):
        embed_layer = model.get_input_embeddings()
        if embed_layer is not None:
            embed_weight = embed_layer.weight
    else:
        print("ERROR: Could not find embedding layer in model")
        return

    embeddings = embed_weight.detach().cpu().numpy()
    vocab_size, embed_dim = embeddings.shape
    print(f"    Embedding matrix: {vocab_size} tokens × {embed_dim} dimensions")

    # Optional PCA pre-reduction for speed
    if args.pca_dim > 0 and embed_dim > args.pca_dim:
        print(f"[2/4] PCA pre-reduction: {embed_dim} → {args.pca_dim} dimensions")
        from sklearn.decomposition import PCA
        pca = PCA(n_components=args.pca_dim, random_state=args.seed)
        embeddings = pca.fit_transform(embeddings)
        print(f"    Variance retained: {pca.explained_variance_ratio_.sum():.2%}")
    else:
        print(f"[2/4] Skipping PCA (embed_dim={embed_dim} <= pca_dim={args.pca_dim})")

    # UMAP reduction
    print(f"[3/4] Running UMAP (n_neighbors={args.n_neighbors}, min_dist={args.min_dist}, epochs={args.n_epochs})...")
    import umap

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=args.n_neighbors,
        min_dist=args.min_dist,
        n_epochs=args.n_epochs,
        metric=args.metric,
        random_state=args.seed,
        verbose=True,
    )

    coords_2d = reducer.fit_transform(embeddings)

    # Normalize to [-1, 1] range
    x_min, x_max = coords_2d[:, 0].min(), coords_2d[:, 0].max()
    y_min, y_max = coords_2d[:, 1].min(), coords_2d[:, 1].max()
    coords_2d[:, 0] = 2.0 * (coords_2d[:, 0] - x_min) / (x_max - x_min) - 1.0
    coords_2d[:, 1] = 2.0 * (coords_2d[:, 1] - y_min) / (y_max - y_min) - 1.0

    print(f"    Output shape: {coords_2d.shape}")
    print(f"    X range: [{coords_2d[:, 0].min():.4f}, {coords_2d[:, 0].max():.4f}]")
    print(f"    Y range: [{coords_2d[:, 1].min():.4f}, {coords_2d[:, 1].max():.4f}]")

    # Write binary file: header (8 bytes) + interleaved float32 coordinates
    print(f"[4/4] Writing binary output: {args.output}")

    import os
    os.makedirs(os.path.dirname(args.output) or '.', exist_ok=True)

    with open(args.output, 'wb') as f:
        # Header: vocab_size (uint32) + version (uint32)
        f.write(struct.pack('<II', vocab_size, 1))
        # Interleaved coordinates: [x0, y0, x1, y1, ...]
        coords_flat = coords_2d.astype(np.float32).tobytes()
        f.write(coords_flat)

    file_size = os.path.getsize(args.output)
    print(f"    File size: {file_size / 1024:.1f} KB ({file_size / (1024*1024):.2f} MB)")
    print(f"    Tokens: {vocab_size}")

    # Also save a small metadata JSON for the frontend
    import json
    meta_path = args.output.replace('.bin', '-meta.json')
    with open(meta_path, 'w') as f:
        json.dump({
            'modelId': args.model,
            'vocabSize': int(vocab_size),
            'embedDim': int(embed_dim),
            'umapParams': {
                'nNeighbors': args.n_neighbors,
                'minDist': args.min_dist,
                'nEpochs': args.n_epochs,
                'metric': args.metric,
                'pcaDim': args.pca_dim,
            },
            'coordRange': {'x': [-1.0, 1.0], 'y': [-1.0, 1.0]},
            'version': 1,
        }, f, indent=2)
    print(f"    Metadata: {meta_path}")
    print("Done!")


if __name__ == '__main__':
    main()
