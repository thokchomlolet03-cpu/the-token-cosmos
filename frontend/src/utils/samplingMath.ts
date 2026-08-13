import {
  RawTokenCandidate,
  ProcessedTokenCandidate,
  SamplingParameters,
  PerplexityData,
  ConfidenceLevel,
  FrictionPoint,
  FrictionReport,
  FrictionSeverity,
} from '../types/sampling';

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

// ============================================================
// PERPLEXITY & UNCERTAINTY HEATMAP ENGINE
// Shannon entropy: H(X) = -Σ P(x) log₂ P(x)
// ============================================================

/**
 * Calculate Shannon entropy (in bits) for a probability distribution.
 * Higher entropy = more uncertainty = more candidates with similar probabilities.
 * Lower entropy = model is confident about the next token.
 */
export function calculateTokenEntropy(candidates: ProcessedTokenCandidate[]): number {
  const active = candidates.filter(c => !c.isFiltered && c.probability > 0);
  if (active.length === 0) return 0;

  let entropy = 0;
  for (const c of active) {
    if (c.probability > 1e-10) {
      entropy -= c.probability * Math.log2(c.probability);
    }
  }
  return Math.max(0, entropy);
}

/**
 * Determine confidence level of a selected token based on its probability and rank.
 * Returns confidence classification, numeric score (0-1), and CSS color.
 */
export function getConfidenceLevel(
  token: ProcessedTokenCandidate,
  distributionEntropy: number
): PerplexityData {
  const prob = token.probability;
  const rank = token.rank;

  // Confidence score: weighted blend of probability and rank position
  // High prob + low rank = high confidence; low prob + high rank = low confidence
  const probScore = Math.min(1, prob * 2); // Cap at 1.0 for 50%+ probability
  const rankScore = Math.max(0, 1 - (rank - 1) / 10); // Top 10 ranks matter
  const entropyPenalty = Math.min(1, distributionEntropy / 5); // Normalize entropy to [0,1]
  const confidenceScore = Math.max(0, Math.min(1,
    probScore * 0.5 + rankScore * 0.3 + (1 - entropyPenalty) * 0.2
  ));

  let confidence: ConfidenceLevel;
  let perplexityColor: string;

  if (rank <= 3 && prob > 0.7) {
    // Top 3 with >70% → high confidence (green)
    confidence = 'high';
    perplexityColor = '#10b981'; // Emerald green
  } else if (prob >= 0.10) {
    // Moderate uncertainty (yellow/amber)
    confidence = 'moderate';
    perplexityColor = '#f59e0b'; // Amber
  } else {
    // High perplexity / surprise — hallucination risk (red)
    confidence = 'low';
    perplexityColor = '#ef4444'; // Red
  }

  return {
    entropy: distributionEntropy,
    confidence,
    confidenceScore,
    perplexityColor,
  };
}

// ============================================================
// FRICTION HUNTER DIAGNOSTIC BRIDGE
// Joint log-probability analysis with sharp drop-off detection
// ============================================================

/**
 * Tokenize input text into sentence-level phrases for friction analysis.
 * Splits on periods, exclamation marks, question marks, semicolons, and newlines.
 */
function tokenizeIntoPhrases(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Calculate a synthetic log-probability score for a phrase based on its token composition.
 * Uses the current sampling parameters and raw logits to estimate phrase likelihood.
 * This is a client-side heuristic — not a true model perplexity computation.
 */
function scorePhraseLogProbability(
  phrase: string,
  rawLogits: RawTokenCandidate[],
  params: SamplingParameters
): number {
  if (!rawLogits || rawLogits.length === 0) return -5.0;

  const words = phrase.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return -5.0;

  let totalLogProb = 0;
  let matchCount = 0;

  for (const word of words) {
    const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanWord.length < 2) continue;

    // Find the best matching candidate in the vocabulary
    const match = rawLogits.find(c => {
      const ct = c.token_str.trim().toLowerCase();
      return ct === cleanWord || ct.includes(cleanWord) || cleanWord.includes(ct);
    });

    if (match) {
      // Convert raw logit to log-probability approximation
      const maxLogit = rawLogits[0]?.raw_logit || 16;
      const logProb = (match.raw_logit - maxLogit) / Math.max(0.1, params.temperature);
      totalLogProb += logProb;
      matchCount++;
    } else {
      // Unknown token penalty (out-of-vocabulary)
      totalLogProb -= 3.5;
      matchCount++;
    }
  }

  return matchCount > 0 ? totalLogProb / matchCount : -5.0;
}

/**
 * Suggest a human-readable reason for a probability drop at a friction point.
 */
function suggestFrictionReason(
  currentPhrase: string,
  previousPhrase: string,
  dropMagnitude: number
): string {
  const curr = currentPhrase.toLowerCase();
  const prev = previousPhrase.toLowerCase();

  // Check for topic shift (few shared words)
  const currWords = new Set(curr.split(/\s+/).filter(w => w.length > 3));
  const prevWords = new Set(prev.split(/\s+/).filter(w => w.length > 3));
  let overlap = 0;
  currWords.forEach(w => { if (prevWords.has(w)) overlap++; });
  const overlapRatio = currWords.size > 0 ? overlap / currWords.size : 0;

  if (overlapRatio < 0.1 && dropMagnitude > 3) {
    return 'Abrupt topic shift — minimal lexical continuity with previous context';
  }
  if (curr.includes('however') || curr.includes('but') || curr.includes('despite') || curr.includes('although')) {
    return 'Contradictory conjunction introduces logical tension with preceding statement';
  }
  if (curr.length > 200) {
    return 'Overly complex sentence structure — high cognitive load for model parsing';
  }
  if (dropMagnitude > 4) {
    return 'Severe probability collapse — language pattern deviates sharply from training distribution';
  }
  if (dropMagnitude > 2) {
    return 'Moderate coherence gap — phrasing may be ambiguous or structurally unusual';
  }
  return 'Minor fluency variation — acceptable in most contexts';
}

/**
 * Detect friction points: locations where log-probability drops sharply between
 * consecutive phrases, indicating logical leaps, ambiguity, or structural issues.
 *
 * Uses σ-based thresholds with user-adjustable sensitivity.
 * sensitivity: 1.0 = strict (only >3σ), 0.5 = moderate, 0.0 = show all (>1σ)
 */
export function detectFrictionPoints(
  phraseScores: Array<{ text: string; logProb: number }>,
  sensitivity: number = 0.5
): FrictionPoint[] {
  if (phraseScores.length < 2) return [];

  // Calculate drops between consecutive phrases
  const drops: number[] = [];
  for (let i = 1; i < phraseScores.length; i++) {
    drops.push(phraseScores[i - 1].logProb - phraseScores[i].logProb);
  }

  // Calculate mean and standard deviation of drops
  const mean = drops.reduce((sum, d) => sum + d, 0) / drops.length;
  const variance = drops.reduce((sum, d) => sum + (d - mean) ** 2, 0) / drops.length;
  const stdDev = Math.sqrt(variance) || 0.5; // Minimum stdDev to avoid divide-by-zero

  // Map sensitivity (0.0–1.0) to sigma threshold (1.0σ–3.0σ)
  const sigmaThreshold = 1.0 + sensitivity * 2.0;

  const frictionPoints: FrictionPoint[] = [];

  for (let i = 1; i < phraseScores.length; i++) {
    const drop = phraseScores[i - 1].logProb - phraseScores[i].logProb;

    if (drop > mean + sigmaThreshold * stdDev * 0.5) {
      // Determine severity based on sigma distance
      const sigmaDistance = stdDev > 0.01 ? (drop - mean) / stdDev : 0;

      let severity: FrictionSeverity;
      if (sigmaDistance > 3) {
        severity = 'critical';
      } else if (sigmaDistance > 2) {
        severity = 'warning';
      } else {
        severity = 'info';
      }

      frictionPoints.push({
        phraseIndex: i,
        phrase: phraseScores[i].text,
        logProbDrop: Math.round(drop * 100) / 100,
        previousLogProb: Math.round(phraseScores[i - 1].logProb * 100) / 100,
        currentLogProb: Math.round(phraseScores[i].logProb * 100) / 100,
        severity,
        reason: suggestFrictionReason(
          phraseScores[i].text,
          phraseScores[i - 1].text,
          drop
        ),
      });
    }
  }

  // Sort by severity (critical first) then by drop magnitude
  const severityOrder: Record<FrictionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  frictionPoints.sort((a, b) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity];
    return s !== 0 ? s : b.logProbDrop - a.logProbDrop;
  });

  return frictionPoints;
}

/**
 * Run complete Friction Analysis on a block of text.
 * Uses requestIdleCallback-style chunking to avoid blocking the main thread.
 * Returns a Promise so the UI can show a loading spinner.
 */
export async function analyzeFriction(
  inputText: string,
  rawLogits: RawTokenCandidate[],
  params: SamplingParameters,
  sensitivity: number = 0.5
): Promise<FrictionReport> {
  const startTime = performance.now();

  const phrases = tokenizeIntoPhrases(inputText);

  // Process phrases in async chunks to keep main thread fluid
  const phraseScores: Array<{ text: string; logProb: number; normalizedScore: number }> = [];
  const CHUNK_SIZE = 10;

  for (let i = 0; i < phrases.length; i += CHUNK_SIZE) {
    const chunk = phrases.slice(i, i + CHUNK_SIZE);

    // Yield to main thread between chunks
    if (i > 0) {
      await new Promise<void>(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
    }

    for (const phrase of chunk) {
      const logProb = scorePhraseLogProbability(phrase, rawLogits, params);
      phraseScores.push({ text: phrase, logProb, normalizedScore: 0 });
    }
  }

  // Normalize scores to 0.0–1.0 range
  if (phraseScores.length > 0) {
    const minScore = Math.min(...phraseScores.map(p => p.logProb));
    const maxScore = Math.max(...phraseScores.map(p => p.logProb));
    const range = maxScore - minScore || 1;
    phraseScores.forEach(p => {
      p.normalizedScore = (p.logProb - minScore) / range;
    });
  }

  // Calculate aggregate metrics
  const totalJointLogProb = phraseScores.reduce((sum, p) => sum + p.logProb, 0);
  const averageLogProb = phraseScores.length > 0
    ? totalJointLogProb / phraseScores.length
    : 0;

  // Detect friction points
  const frictionPoints = detectFrictionPoints(phraseScores, sensitivity);

  const analysisTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    inputText,
    totalJointLogProb: Math.round(totalJointLogProb * 100) / 100,
    averageLogProb: Math.round(averageLogProb * 100) / 100,
    phrases: phraseScores,
    frictionPoints,
    analysisTimeMs,
  };
}

// ============================================================
// BYOE / External API Normalization
// ============================================================

/**
 * Data Normalization Adapter for External OpenAI-compatible / BYOE logprobs responses.
 * Converts OpenAI-compatible API response shapes into standardized RawTokenCandidate[] arrays.
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
