import { RawTokenCandidate, ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';

/**
 * Pure Client-Side Math Pipeline for LLM Token Sampling
 * Runs at 60 FPS in browser memory without backend re-fetches.
 * Implements Log-Sum-Exp / Max-Subtraction trick for numerical stability
 * and zero-temperature greedy fallback.
 */
export function calculateTokenProbabilities(
  rawCandidates: RawTokenCandidate[],
  params: SamplingParameters,
  contextHistoryTokens: string[] = []
): ProcessedTokenCandidate[] {
  if (!rawCandidates || rawCandidates.length === 0) return [];

  // 1. Calculate frequency and presence context maps
  const tokenCounts: Record<string, number> = {};
  contextHistoryTokens.forEach(t => {
    const clean = t.trim();
    tokenCounts[t] = (tokenCounts[t] || 0) + 1;
    if (clean !== t) {
      tokenCounts[clean] = (tokenCounts[clean] || 0) + 1;
    }
  });

  // 2. Compute Adjusted Logits (apply Logit Bias & Frequency/Presence Penalties)
  const adjustedItems = rawCandidates.map(c => {
    let bias = 0;
    const tokenClean = c.token_str.trim();

    // Check logit biases (direct match or case-insensitive match)
    if (params.logitBiases) {
      if (params.logitBiases[c.token_str] !== undefined) {
        bias += params.logitBiases[c.token_str];
      } else if (params.logitBiases[tokenClean] !== undefined) {
        bias += params.logitBiases[tokenClean];
      }
    }

    const count = Math.max(tokenCounts[c.token_str] || 0, tokenCounts[tokenClean] || 0);
    const presence = count > 0 ? 1 : 0;
    const penalty = (params.presencePenalty * presence) + (params.frequencyPenalty * count);

    const adjusted_logit = c.raw_logit + bias - penalty;

    return {
      ...c,
      adjusted_logit,
      isHistorical: count > 0,
      historicalCount: count,
    };
  });

  // Sort descending by adjusted logit
  adjustedItems.sort((a, b) => b.adjusted_logit - a.adjusted_logit);

  // 3. Handle Zero-Temperature / Greedy Sampling Fallback (T <= 0.01)
  const temp = Math.max(0.001, params.temperature);
  let probabilities: number[] = new Array(adjustedItems.length).fill(0);

  if (temp <= 0.01) {
    // Greedy mode: highest logit gets 1.0 (100%), all others 0.0%
    probabilities[0] = 1.0;
  } else {
    // 4. Numerically Stable Softmax (Log-Sum-Exp / Max-Subtraction Trick)
    // P(x_i) = exp((z_i - z_max) / T) / sum_j exp((z_j - z_max) / T)
    const maxLogit = adjustedItems[0].adjusted_logit;
    const expValues = adjustedItems.map(item => Math.exp((item.adjusted_logit - maxLogit) / temp));
    const sumExp = expValues.reduce((sum, val) => sum + val, 0);

    probabilities = expValues.map(val => (sumExp > 0 ? val / sumExp : 0));
  }

  // Combine items with initial softmax probabilities
  let candidates: ProcessedTokenCandidate[] = adjustedItems.map((item, index) => ({
    ...item,
    probability: probabilities[index],
    rank: index + 1,
    isFiltered: false,
    orbitRadius: 0,
    orbitAngle: 0,
    size: 0,
    color: '',
  }));

  // 5. Apply Top-K Filtering
  const k = Math.min(Math.max(1, Math.round(params.topK)), candidates.length);
  candidates.forEach((c, i) => {
    if (i >= k && !c.isFiltered) {
      c.isFiltered = true;
      c.filterReason = 'Top-K';
    }
  });

  // 6. Apply Top-P (Nucleus) Filtering
  // Cumulative sum of unfiltered candidates
  let cumulativeP = 0;
  const pThreshold = Math.min(1.0, Math.max(0.05, params.topP));
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.isFiltered) {
      if (cumulativeP >= pThreshold) {
        c.isFiltered = true;
        c.filterReason = 'Top-P';
      } else {
        cumulativeP += c.probability;
      }
    }
  }

  // 7. Apply Min-P Filtering
  // Discard candidates whose probability < (minP * max_unfiltered_prob)
  const maxProb = candidates.length > 0 ? candidates[0].probability : 0;
  const minPThreshold = params.minP * maxProb;
  candidates.forEach(c => {
    if (!c.isFiltered && c.probability < minPThreshold) {
      c.isFiltered = true;
      c.filterReason = 'Min-P';
    }
  });

  // Check for banned logit bias (-100)
  candidates.forEach(c => {
    if (c.adjusted_logit <= -50) {
      c.isFiltered = true;
      c.filterReason = 'Banned';
    }
  });

  // 8. Re-normalize probabilities among non-filtered candidates for display
  const activeCandidates = candidates.filter(c => !c.isFiltered);
  const activeProbSum = activeCandidates.reduce((sum, c) => sum + c.probability, 0);

  candidates.forEach(c => {
    if (!c.isFiltered) {
      c.probability = activeProbSum > 0 ? c.probability / activeProbSum : 0;
    } else {
      c.probability = 0;
    }
  });

  // 9. Assign Visual Properties (Cosmos Starfield positions, sizes, colors)
  const totalCount = candidates.length;
  candidates.forEach((c, index) => {
    // Rank 1 star is center supergiant
    const rankRatio = index / Math.max(1, totalCount - 1);
    
    // Radius from center (0 = center, 100 = outer asteroid belt)
    const baseRadius = index === 0 ? 0 : 35 + rankRatio * 180;
    c.orbitRadius = baseRadius;
    
    // Golden angle distribution for natural celestial spiraling
    c.orbitAngle = (index * 137.5 * Math.PI) / 180;

    // Star visual size proportional to probability percentage
    if (index === 0) {
      c.size = 18 + c.probability * 25; // Supergiant center star
    } else if (!c.isFiltered) {
      c.size = 6 + c.probability * 20;
    } else {
      c.size = 3; // Dim asteroid
    }

    // Color palette based on status & grounding
    if (c.filterReason === 'Banned') {
      c.color = '#1e293b'; // Imploded dark slate gray black hole
    } else if (c.is_rag_grounded) {
      c.color = '#06b6d4'; // Cyan RAG Fact Anchor
    } else if (index === 0) {
      c.color = '#f59e0b'; // Gold supergiant
    } else if (!c.isFiltered) {
      if (c.probability > 0.15) {
        c.color = '#38bdf8'; // Bright sky blue
      } else if (c.probability > 0.05) {
        c.color = '#a855f7'; // Neon purple
      } else {
        c.color = '#ec4899'; // Vibrant pink
      }
    } else {
      c.color = '#475569'; // Desaturated slate gray for filtered asteroids
    }
  });

  return candidates;
}

/**
 * Data Normalization Adapter for External OpenAI-compatible / BYOE logprobs responses.
 * Converts API response shapes (OpenAI v1, vLLM, LM Studio, Ollama, Gemini) into standardized RawTokenCandidate[] array.
 */
export function normalizeOpenAILogprobs(responseJson: any, ragContextText?: string): RawTokenCandidate[] {
  if (!responseJson) return [];

  const candidates: RawTokenCandidate[] = [];
  const ragKeywords = ragContextText ? ragContextText.split(/\s+/).filter(w => w.length > 3) : [];

  let topLogprobsList: Array<{ token: string; logprob: number }> = [];

  try {
    // 1. OpenAI Chat Completions v1 format: choices[0].logprobs.content[0].top_logprobs
    if (responseJson?.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs) {
      const topArr = responseJson.choices[0].logprobs.content[0].top_logprobs;
      topLogprobsList = topArr.map((item: any) => ({
        token: item.token || item.text || '',
        logprob: typeof item.logprob === 'number' ? item.logprob : -5.0,
      }));
    }
    // 2. Legacy completions format / vLLM map: choices[0].logprobs.top_logprobs[0] = { "token": -logprob }
    else if (responseJson?.choices?.[0]?.logprobs?.top_logprobs?.[0]) {
      const topObj = responseJson.choices[0].logprobs.top_logprobs[0];
      if (Array.isArray(topObj)) {
        topLogprobsList = topObj.map((item: any) => ({
          token: item.token || '',
          logprob: typeof item.logprob === 'number' ? item.logprob : -5.0,
        }));
      } else if (typeof topObj === 'object') {
        topLogprobsList = Object.entries(topObj).map(([token, logprob]) => ({
          token,
          logprob: typeof logprob === 'number' ? (logprob as number) : -5.0,
        }));
      }
    }
    // 3. Fallback candidates array
    else if (Array.isArray(responseJson?.candidates)) {
      return responseJson.candidates;
    }
  } catch (e) {
    console.warn('Failed to parse external logprobs response, using fallback candidates:', e);
  }

  // Convert logprobs to raw_logits (raw_logit ~ logprob + 16.0 or exact logprob)
  topLogprobsList.forEach((item, index) => {
    // Convert log probability (e.g. -0.15) to positive raw logit scale for starfield rendering
    const raw_logit = Math.round((item.logprob + 16.0) * 100) / 100;
    const token_str = item.token || `token_${index + 1}`;

    let is_rag_grounded = false;
    if (ragKeywords.length > 0) {
      const cleanW = token_str.trim().toLowerCase();
      if (cleanW.length > 2) {
        is_rag_grounded = ragKeywords.some(kw => kw.toLowerCase().includes(cleanW) || cleanW.includes(kw.toLowerCase()));
      }
    }

    candidates.push({
      token_id: 5000 + index,
      token_str,
      raw_logit,
      is_rag_grounded,
    });
  });

  candidates.sort((a, b) => b.raw_logit - a.raw_logit);
  return candidates;
}

