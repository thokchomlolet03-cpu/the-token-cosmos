import { useMemo } from 'react';
import { LabScenario, LabEvaluationResult, VerificationRule } from '../../types/labs';
import { SamplingParameters, FlightStep } from '../../types/sampling';

interface UseLabVerifierProps {
  scenario: LabScenario | null;
  params: SamplingParameters;
  flightSteps: FlightStep[];
  outputText: string;
  ragContext?: string;
  isGenerating: boolean;
  isLoopAborted?: boolean;
}

export function useLabVerifier({
  scenario,
  params,
  flightSteps,
  outputText,
  ragContext = '',
  isGenerating,
  isLoopAborted = false,
}: UseLabVerifierProps): LabEvaluationResult {
  return useMemo(() => {
    if (!scenario) {
      return {
        status: 'unattempted',
        feedback: 'Select a lab scenario to begin guided challenge.',
        passedRuleIds: [],
        failedRuleIds: [],
        metrics: {},
      };
    }

    if (isLoopAborted) {
      return {
        status: 'aborted',
        feedback: '⚠️ Catastrophic loop detected by WebWorker. Generation halted to protect GPU memory.',
        passedRuleIds: [],
        failedRuleIds: scenario.verificationRules.map((r) => r.id),
        metrics: { isLoopAborted: true },
      };
    }

    if (isGenerating) {
      return {
        status: 'running',
        feedback: 'Analyzing token distribution and sampling dynamics in real-time...',
        passedRuleIds: [],
        failedRuleIds: [],
        metrics: { tokensGenerated: flightSteps.length },
      };
    }

    if (flightSteps.length === 0 && !outputText.trim()) {
      return {
        status: 'unattempted',
        feedback: 'Configure parameters and click Generate to evaluate this scenario.',
        passedRuleIds: [],
        failedRuleIds: [],
        metrics: {},
      };
    }

    const passedRuleIds: string[] = [];
    const failedRuleIds: string[] = [];

    // Metric Calculations
    let repeatCount = 0;
    const cleanTokens = flightSteps.map((s) => s.selectedToken.token_str.trim().toLowerCase());
    
    // Check 4-gram repetition
    if (cleanTokens.length >= 8) {
      for (let i = 0; i <= cleanTokens.length - 8; i++) {
        const gram1 = cleanTokens.slice(i, i + 4).join(' ');
        for (let j = i + 4; j <= cleanTokens.length - 4; j++) {
          const gram2 = cleanTokens.slice(j, j + 4).join(' ');
          if (gram1.length > 5 && gram1 === gram2) {
            repeatCount++;
          }
        }
      }
    }

    // Grounding Ratio
    let groundingRatio = 0;
    if (ragContext && ragContext.trim().length > 0 && flightSteps.length > 0) {
      const ragWords = new Set(
        ragContext
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );
      const groundedTokens = flightSteps.filter((s) =>
        ragWords.has(s.selectedToken.token_str.trim().toLowerCase())
      );
      groundingRatio = groundedTokens.length / flightSteps.length;
    }

    // Entropy Calculations
    let avgEntropy = 0;
    let maxEntropy = 0;
    if (flightSteps.length > 0) {
      const entropies = flightSteps
        .map((s) => {
          const probs = s.rawLogits.map((c) => Math.exp(c.raw_logit)).filter((p) => p > 0);
          const sum = probs.reduce((a, b) => a + b, 0);
          if (sum <= 0) return 0;
          return probs.reduce((acc, p) => {
            const norm = p / sum;
            return acc - norm * Math.log2(norm + 1e-10);
          }, 0);
        })
        .filter((e) => !isNaN(e) && isFinite(e));

      if (entropies.length > 0) {
        avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;
        maxEntropy = Math.max(...entropies);
      }
    }

    // Evaluate each rule
    for (const rule of scenario.verificationRules) {
      let rulePassed = false;

      switch (rule.type) {
        case 'no_repeat_ngrams':
          rulePassed = repeatCount === 0 && !isLoopAborted;
          break;

        case 'min_grounding_ratio':
          rulePassed = groundingRatio >= (rule.threshold ?? 0.7);
          break;

        case 'max_entropy':
          rulePassed = avgEntropy <= (rule.threshold ?? 0.8) && flightSteps.length >= 5;
          break;

        case 'thinking_contrast':
          rulePassed = outputText.includes('</think>') || flightSteps.some((s) => !s.selectedToken.isHistorical);
          break;

        case 'parameter_range':
          if (rule.paramKey && params[rule.paramKey] !== undefined) {
            const val = params[rule.paramKey] as number;
            const minOk = rule.minVal === undefined || val >= rule.minVal;
            const maxOk = rule.maxVal === undefined || val <= rule.maxVal;
            rulePassed = minOk && maxOk;
          }
          break;
      }

      if (rulePassed) {
        passedRuleIds.push(rule.id);
      } else {
        failedRuleIds.push(rule.id);
      }
    }

    const allPassed = passedRuleIds.length === scenario.verificationRules.length && failedRuleIds.length === 0;

    return {
      status: allPassed ? 'passed' : 'failed',
      feedback: allPassed
        ? '🎉 Lab Challenge Solved! Sampling parameters successfully calibrated.'
        : `Criteria not met (${passedRuleIds.length}/${scenario.verificationRules.length} rules passed). Inspect hints and adjust sliders.`,
      passedRuleIds,
      failedRuleIds,
      metrics: {
        repeatCount,
        groundingRatio: Math.round(groundingRatio * 100),
        avgEntropy: Math.round(avgEntropy * 100) / 100,
        maxEntropy: Math.round(maxEntropy * 100) / 100,
        tokensGenerated: flightSteps.length,
        isLoopAborted,
      },
    };
  }, [scenario, params, flightSteps, outputText, ragContext, isGenerating, isLoopAborted]);
}
