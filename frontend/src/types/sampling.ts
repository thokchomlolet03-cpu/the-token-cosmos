export interface RawTokenCandidate {
  token_id: number;
  token_str: string;
  raw_logit: number;
  is_rag_grounded?: boolean;
}

export interface ProcessedTokenCandidate extends RawTokenCandidate {
  adjusted_logit: number;
  probability: number; // 0.0 to 1.0 (0% to 100%)
  rank: number; // 1-indexed
  isFiltered: boolean;
  filterReason?: 'Top-K' | 'Top-P' | 'Min-P' | 'Banned' | 'Temperature';
  isHistorical?: boolean;
  historicalCount?: number;
  orbitRadius: number; // calculated visual position
  orbitAngle: number;
  size: number;
  color: string;
}

export interface SamplingParameters {
  temperature: number; // 0.01 to 2.0
  topK: number; // 1 to 50
  topP: number; // 0.05 to 1.0
  minP: number; // 0.01 to 0.5
  frequencyPenalty: number; // 0.0 to 1.5
  presencePenalty: number; // 0.0 to 1.5
  stopSequences: string[];
  logitBiases: Record<string, number>; // token_str -> float bias (e.g. -100 or +5)
}

export interface PresetScenario {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  params: Partial<SamplingParameters>;
  ragEnabled: boolean;
  prompt: string;
  ragContext: string;
}

// Perplexity & Confidence metadata per-token in the FlightPath
export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export interface PerplexityData {
  entropy: number;        // Shannon entropy in bits for the distribution at this step
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0.0 (lowest) to 1.0 (highest confidence)
  perplexityColor: string; // CSS color based on confidence level
}

export interface FlightStep {
  stepIndex: number;
  selectedToken: ProcessedTokenCandidate;
  promptSnippet: string;
  rawLogits: RawTokenCandidate[];
  params: SamplingParameters;
  ragEnabled: boolean;
  perplexity?: PerplexityData; // Computed lazily for heatmap
}

// A/B Duel Mode configuration
export interface DuelConfig {
  enabled: boolean;
  mode: 'temperature' | 'byoe'; // temperature fallback vs BYOE engine comparison
  secondaryTemp: number;         // Temperature for secondary pane (fallback mode)
  label: {
    left: string;
    right: string;
  };
}

// Friction Hunter Diagnostic Bridge
export type FrictionSeverity = 'critical' | 'warning' | 'info';

export interface FrictionPoint {
  phraseIndex: number;
  phrase: string;
  logProbDrop: number;       // Magnitude of the log-probability drop
  previousLogProb: number;
  currentLogProb: number;
  severity: FrictionSeverity;
  reason: string;            // Suggested reason for the drop
}

export interface FrictionReport {
  inputText: string;
  totalJointLogProb: number;
  averageLogProb: number;
  phrases: Array<{
    text: string;
    logProb: number;
    normalizedScore: number;  // 0.0 to 1.0
  }>;
  frictionPoints: FrictionPoint[];
  analysisTimeMs: number;
}
