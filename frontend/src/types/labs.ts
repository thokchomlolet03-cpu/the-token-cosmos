import { SamplingParameters } from './sampling';

export type LabDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type LabVerificationStatus = 'unattempted' | 'running' | 'passed' | 'failed' | 'aborted';

export interface VerificationRule {
  id: string;
  type: 'no_repeat_ngrams' | 'min_grounding_ratio' | 'max_entropy' | 'thinking_contrast' | 'parameter_range';
  description: string;
  targetMetric?: string;
  threshold?: number;
  paramKey?: keyof SamplingParameters;
  minVal?: number;
  maxVal?: number;
}

export interface LabScenario {
  id: string;
  title: string;
  subtitle: string;
  difficulty: LabDifficulty;
  badge: string;
  conceptTaught: string;
  description: string;
  objective: string;
  brokenPrompt: string;
  ragContext?: string;
  ragEnabled?: boolean;
  initialParams: Partial<SamplingParameters>;
  targetParamHints: string[];
  verificationRules: VerificationRule[];
  hints: string[];
  solutionExplanation: string;
}

export interface LabEvaluationResult {
  status: LabVerificationStatus;
  feedback: string;
  passedRuleIds: string[];
  failedRuleIds: string[];
  metrics: {
    repeatCount?: number;
    groundingRatio?: number;
    maxEntropy?: number;
    avgEntropy?: number;
    tokensGenerated?: number;
    isLoopAborted?: boolean;
  };
}

export interface LabProgressState {
  completedLabIds: string[];
  activeLabId: string | null;
  attemptsCount: Record<string, number>;
  bestScores: Record<string, number>;
}
