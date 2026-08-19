# Interactive Guided Labs Curriculum

This document provides a comprehensive curriculum reference for the **Interactive Guided Labs** in The Token Cosmos Studio (`LABS` mode). These labs provide hands-on, gamified training for AI engineers and prompt engineers to understand and control language model token probability distributions.

---

## 1. Overview & Pedagogical Philosophy

Rather than treating language models as black-box text generators, The Token Cosmos Interactive Labs place engineers into real-world failure scenarios where sampling parameters have caused catastrophic behavior (infinite loops, hallucinations, corrupted JSON, or stalled reasoning streams). 

Each lab presents:
1. **The Scenario Briefing**: Background context on why this failure happens in production.
2. **The Broken Baseline**: Pre-configured prompt and flawed sampling parameters.
3. **The 3D Celestial X-Ray**: Visualizing the token distribution, entropy manifold, and RAG grounding lasers in real time.
4. **Programmatic Assertion Rules**: Automated verification checking if the output buffer meets strict quantitative quality criteria.

```
                          LAB SOLVING WORKFLOW
                          
   1. Select Challenge        2. Observe Malfunction        3. Calibrate Sampling        4. Programmatic Pass
  ┌───────────────────┐      ┌─────────────────────┐       ┌────────────────────┐       ┌──────────────────┐
  │ Lab Briefing &    │ ───> │ Broken Prompt Emits │ ────> │ Adjust Min-P, Temp,│ ────> │ Output satisfies │
  │ Target Objective  │      │ Loops/Hallucinations│       │ Freq/Pres Penalties│       │ Assertion Rules  │
  └───────────────────┘      └─────────────────────┘       └────────────────────┘       └──────────────────┘
```

---

## 2. The 4 Interactive Challenge Scenarios

### Lab 1: The Infinite Repetition Loop Trap
- **Difficulty**: Beginner
- **Concept Taught**: Autoregressive Feedback Loops & Repetition Penalties
- **Production Problem**: Customer service bots and code generators often get trapped in recursive feedback loops repeating the same sentence indefinitely, racking up token costs and hanging user sessions.
- **Broken Parameters**:
  - `Temperature`: `0.30`
  - `Top-P`: `1.00`
  - `Min-P`: `0.00`
  - `Frequency Penalty`: `0.00`
  - `Presence Penalty`: `0.00`
- **Objective**: Eliminate repeated 4-gram token sequences by raising the Frequency Penalty ($\ge 0.4$) and Min-P ($\ge 0.05$).
- **Verification Rule**: Output buffer contains zero repetitive 4-gram sequences.
- **Worker Safeguard**: If an endless loop is generated, the WebWorker in-thread cycle detector automatically interrupts the engine via `engine.interruptGenerate()` and cleanly flushes the KV cache via `engine.resetChat()`.

---

### Lab 2: The RAG Grounding Defect
- **Difficulty**: Intermediate
- **Concept Taught**: Retrieval Grounding vs. Pre-Training Parametric Hallucination
- **Production Problem**: High sampling temperatures flatten the probability distribution across unrelated vocabulary, causing the model to hallucinate numbers rather than adhering to retrieved RAG context documents.
- **Broken Parameters**:
  - `Temperature`: `1.30`
  - `Top-P`: `0.98`
  - `Min-P`: `0.00`
- **Objective**: Lower Temperature ($\le 0.50$) and raise Min-P ($\ge 0.08$) until context grounding overlap exceeds $70\%$.
- **Verification Rule**: Grounding overlap ratio $\ge 70\%$ against the Tier 2 Verification Policy document.
- **Visual Cue**: Observe the cyan laser beams connecting candidate tokens directly to the retrieved RAG context.

---

### Lab 3: Structured JSON Stability
- **Difficulty**: Intermediate
- **Concept Taught**: Shannon Entropy Compression at Syntax Junctions
- **Production Problem**: Automated downstream parsing pipelines break when language models emit invalid JSON syntax, unclosed braces, or hallucinated keys due to excessive sampling entropy at grammar junctions.
- **Broken Parameters**:
  - `Temperature`: `1.40`
  - `Top-P`: `0.99`
  - `Min-P`: `0.00`
- **Objective**: Compress entropy ($\text{Avg } H < 0.6 \text{ bits}$) by setting near-greedy sampling ($T \le 0.30$) to guarantee deterministic schema syntax.
- **Verification Rule**: Average Shannon Entropy $\le 0.6$ bits across generated tokens.

---

### Lab 4: The Cognitive Orbit X-Ray
- **Difficulty**: Advanced
- **Concept Taught**: Chain-of-Thought Entropy Contraction & Monologue Decoupling
- **Production Problem**: Reasoning models (e.g. DeepSeek-R1, QwQ) generate internal thought streams inside `<think>` tags. Understanding when the model transitions from divergent hypothesis exploration to decisive answer emission is critical for token pruning.
- **Objective**: Observe the diffuse cloud of cognitive asteroids during the thinking monologue and verify that probability distribution collapses into a single high-confidence Supergiant star once the reasoning completes.
- **Verification Rule**: Successful cognitive monologue parsing and decisive final answer emission.

---

## 3. Programmatic Evaluation Engine

The lab verification engine ([useLabVerifier.ts](file:///Users/lolet/The%20Token%20Cosmos/frontend/src/components/InteractiveLabs/useLabVerifier.ts)) performs real-time mathematical validation against the token stream:

1. **Repetition N-Gram Check**:

   $$\text{RepeatCount} = \sum_{i} \mathbb{I}(\text{token}_{i:i+n} == \text{token}_{j:j+n})$$

2. **Grounding Ratio**:

   $$\text{GroundingRatio} = \frac{|\text{Tokens} \cap \text{RAG Context Words}|}{|\text{Total Generated Tokens}|}$$

3. **Shannon Entropy**:

   $$H = -\sum_{k} p_k \log_2(p_k)$$

---

## 4. Local & Offline Operation

All interactive labs run **100% client-side** using `@mlc-ai/web-llm` over local WebGPU or synthetic mathematical fallbacks. Zero user prompt data or telemetry leaves the local browser environment.
