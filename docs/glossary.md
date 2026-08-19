# LLM & WebGPU Glossary

A dictionary of terms, parameters, and technologies referenced throughout The Token Cosmos.

---

## 1. Mathematical Sampling Parameters

### Logit
The raw, unnormalized prediction score output by the final linear layer of a Transformer model for each token in the vocabulary. Logits range from negative infinity to positive infinity; higher values indicate that the model believes that token is a more likely continuation.

### Softmax
The mathematical activation function that maps raw logits $z$ to a probability distribution $P$ where all values are between 0 and 1, and sum up to 1.0:

$$P(x_i) = \frac{e^{z_i}}{\sum_j e^{z_j}}$$

### Temperature ($T$)
A scaling factor applied to logits before the Softmax function: $z_i' = z_i / T$. 
- Higher values flatten the probability distribution, making outputs more diverse but less coherent.
- Lower values sharpen the distribution around the top choice, making outputs more predictable.

### Top-K
A sampling filter that restricts selection to the $K$ candidates with the highest probabilities. For example, if $K=50$, only the top 50 tokens are evaluated, and all others are ignored.

### Top-P (Nucleus Sampling)
A sampling filter that selects the smallest set of tokens whose cumulative probability exceeds the threshold $P$. If $P=0.90$, the candidate list is restricted to the top tokens that together represent 90% of the probability weight.

### Min-P
A relative probability threshold filter. It discards tokens whose probability is less than a fraction $p$ of the highest token's probability ($P_{\max}$). If $P_{\max} = 0.60$ and Min-P is set to $0.05$, only tokens with probabilities $\ge 0.03$ are kept.

### Entropy (bits)
A measurement of the randomness or uncertainty in the token probability distribution. Higher entropy indicates the model is unsure of the next word (many candidates are equally likely); low entropy indicates the model is highly confident (one or two candidates dominate).

---

## 2. Infrastructure & Model Technologies

### WebGPU
A modern W3C browser API that provides web applications with high-performance, low-latency access to the system's graphics processing unit (GPU). It is the successor to WebGL, enabling heavy neural network matrix calculations to execute locally in browser memory.

### GGUF (GPT-Generated Unified Format)
A file format designed for storing quantized models optimized for fast local execution on CPUs and consumer GPUs (popularized by `llama.cpp`). It bundles tokenizer vocabulary config and neural weights into a single file.

### RAG (Retrieval-Augmented Generation)
An architectural pattern where relevant external documents/context are retrieved and appended to the model's prompt. In the visualizer, RAG grounding is shown as glowing laser lines pulling fact-backed tokens to the center orbit.

### KV-Cache (Key-Value Cache)
A memory optimization used during autoregressive generation. Instead of recalculating key and value vectors for all previous tokens in transformer self-attention blocks, these vectors are cached in memory, reducing processing times from $O(N^2)$ to $O(N)$ per generated token.

### UMAP (Uniform Manifold Approximation and Projection)
A non-linear dimension reduction technique. In this application, it is used to compress high-dimensional token embeddings (typically 1024+ dimensions) into 2D coordinates so they can be plotted on the canvas as a semantic map.
