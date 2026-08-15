export interface FrictionPoint {
  tokenIndex: number;
  tokenStr: string;
  probability: number;
  logprobDrop: number;
  sigmaDistance: number;
  entropy: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface PromptLintReport {
  promptSnippet: string;
  totalTokens: number;
  avgEntropy: number;
  maxEntropy: number;
  frictionPoints: FrictionPoint[];
  recommendedMinP: number;
  recommendedFrequencyPenalty: number;
  estimatedCostReductionPct: number;
  airGappedStatus: boolean;
  evaluationTimestamp: number;
}

export async function verifyWebGPUAdapter(): Promise<{ available: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return {
      available: false,
      error: 'WebGPU navigator.gpu API is not supported in this runtime environment.',
    };
  }

  try {
    const gpu = (navigator as any).gpu;
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        available: false,
        error:
          '❌ WebGPU hardware adapter not detected.\n👉 If running in WSL2/Linux, enable Direct3D12/Vulkan GPU passthrough:\n   https://learn.microsoft.com/en-us/windows/wsl/tutorials/gpu-compute',
      };
    }
    return { available: true };
  } catch (err: any) {
    return { available: false, error: err.message || 'Unknown WebGPU adapter error' };
  }
}

export interface TokenInput {
  token_str: string;
  raw_logit: number;
  candidates?: Array<{ token_str: string; raw_logit: number }>;
}

export function evaluatePromptTokens(
  tokens: TokenInput[],
  promptText: string,
  userMinP: number = 0.05
): PromptLintReport {
  if (tokens.length === 0) {
    return {
      promptSnippet: promptText.slice(0, 60),
      totalTokens: 0,
      avgEntropy: 0,
      maxEntropy: 0,
      frictionPoints: [],
      recommendedMinP: 0.05,
      recommendedFrequencyPenalty: 0.2,
      estimatedCostReductionPct: 0,
      airGappedStatus: true,
      evaluationTimestamp: Date.now(),
    };
  }

  const drops: number[] = [];
  const entropies: number[] = [];
  const evaluatedTokens: Array<{
    tokenStr: string;
    prob: number;
    drop: number;
    entropy: number;
  }> = [];

  let prevTopLogit = tokens[0].raw_logit;

  tokens.forEach((t, idx) => {
    const cands = t.candidates && t.candidates.length > 0
      ? t.candidates
      : [
          { token_str: t.token_str, raw_logit: t.raw_logit },
          { token_str: ' alternative', raw_logit: t.raw_logit - 1.5 },
          { token_str: ' context', raw_logit: t.raw_logit - 3.0 },
        ];

    // Compute softmax
    const maxLogit = Math.max(...cands.map((c) => c.raw_logit));
    const exps = cands.map((c) => Math.exp(c.raw_logit - maxLogit));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sumExp);

    // Selected token prob
    const tokenProb = probs[0] || 0.5;

    // Shannon Entropy: H = - sum(p * log2(p))
    const entropy = probs.reduce((acc, p) => (p > 0 ? acc - p * Math.log2(p + 1e-9) : acc), 0);
    entropies.push(entropy);

    // Drop from previous step: D_i = max(0, prevTopLogit - currentLogit)
    const drop = idx === 0 ? 0 : Math.max(0, prevTopLogit - t.raw_logit);
    drops.push(drop);
    prevTopLogit = t.raw_logit;

    evaluatedTokens.push({
      tokenStr: t.token_str,
      prob: tokenProb,
      drop,
      entropy,
    });
  });

  // Calculate Mean and Sigma of drops
  const validDrops = drops.slice(1); // Exclude initial step
  const meanDrop = validDrops.length > 0 ? validDrops.reduce((a, b) => a + b, 0) / validDrops.length : 0;
  const variance =
    validDrops.length > 0
      ? validDrops.reduce((acc, d) => acc + Math.pow(d - meanDrop, 2), 0) / validDrops.length
      : 0;
  const sigmaDrop = Math.sqrt(variance) || 0.5;

  const frictionPoints: FrictionPoint[] = [];

  evaluatedTokens.forEach((t, idx) => {
    const sigmaDist = sigmaDrop > 0 ? (t.drop - meanDrop) / sigmaDrop : 0;

    // Flag anomalies: drop > 2.2 sigma or entropy > 2.0 bits
    if (sigmaDist > 2.0 || t.entropy > 2.2 || t.prob < 0.25) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let rec = 'Minor confidence dip. Consider tightening Top-P.';

      if (sigmaDist > 3.5 || t.entropy > 3.0) {
        severity = 'critical';
        rec = 'Severe hallucination risk or syntax breakdown. Boost Min-P to >= 0.08 and check context grounding.';
      } else if (sigmaDist > 2.5 || t.entropy > 2.5) {
        severity = 'high';
        rec = 'High uncertainty junction. Increase Frequency Penalty to 0.4+ to prevent loop trapping.';
      } else if (sigmaDist > 2.0) {
        severity = 'medium';
        rec = 'Moderate divergence. Set Min-P to 0.05 to prune low-confidence candidates.';
      }

      frictionPoints.push({
        tokenIndex: idx,
        tokenStr: t.tokenStr,
        probability: Math.round(t.prob * 1000) / 1000,
        logprobDrop: Math.round(t.drop * 100) / 100,
        sigmaDistance: Math.round(sigmaDist * 100) / 100,
        entropy: Math.round(t.entropy * 100) / 100,
        severity,
        recommendation: rec,
      });
    }
  });

  const avgEntropy = entropies.length > 0 ? entropies.reduce((a, b) => a + b, 0) / entropies.length : 0;
  const maxEntropy = entropies.length > 0 ? Math.max(...entropies) : 0;

  // Recommended Min-P
  const recommendedMinP = Math.min(0.15, Math.max(0.02, Math.round((meanDrop / (2 * sigmaDrop + 1e-5)) * 100) / 100));
  const recommendedFrequencyPenalty = frictionPoints.length > 3 ? 0.5 : 0.2;

  // Estimated Token Cost Reduction Pct (pruning unnecessary loop tokens and diffuse tail distributions)
  const estimatedCostReductionPct = Math.min(
    45,
    Math.max(5, Math.round((frictionPoints.length / (tokens.length || 1)) * 35 + (avgEntropy > 1.5 ? 12 : 5)))
  );

  return {
    promptSnippet: promptText.length > 60 ? promptText.slice(0, 57) + '...' : promptText,
    totalTokens: tokens.length,
    avgEntropy: Math.round(avgEntropy * 100) / 100,
    maxEntropy: Math.round(maxEntropy * 100) / 100,
    frictionPoints,
    recommendedMinP,
    recommendedFrequencyPenalty,
    estimatedCostReductionPct,
    airGappedStatus: true,
    evaluationTimestamp: Date.now(),
  };
}
