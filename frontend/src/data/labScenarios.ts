import { LabScenario } from '../types/labs';

export const LAB_SCENARIOS: LabScenario[] = [
  {
    id: 'lab-1-infinite-loop',
    title: 'Lab 1: The Infinite Repetition Loop',
    subtitle: 'Frequency Penalties & Min-P Cutoff vs. Greedy Traps',
    difficulty: 'beginner',
    badge: 'Loop Defense',
    conceptTaught: 'Autoregressive Feedback Loops & Repetition Penalties',
    description:
      'The model is trapped in an infinite recursive loop repeating customer service boilerplate. Your goal is to break the loop and produce a natural, coherent response without causing the generation to collapse.',
    objective:
      'Adjust the Frequency Penalty (>= 0.4) and Min-P (>= 0.05) sliders to eliminate repeating 4-gram sequences.',
    brokenPrompt:
      'Please verify your account details. For your security, please verify your account number. To proceed, please verify your account number and confirm your details. Please verify your account',
    initialParams: {
      temperature: 0.3,
      topK: 50,
      topP: 1.0,
      minP: 0.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    },
    targetParamHints: [
      'Increase Frequency Penalty to between 0.4 and 0.8',
      'Set Min-P to at least 0.05 to prune low-probability echo tokens',
    ],
    verificationRules: [
      {
        id: 'rule-loop-broken',
        type: 'no_repeat_ngrams',
        description: 'Zero repetitive 4-gram sequences in output buffer',
        threshold: 1,
      },
      {
        id: 'rule-penalty-set',
        type: 'parameter_range',
        description: 'Frequency Penalty set to >= 0.3',
        paramKey: 'frequencyPenalty',
        minVal: 0.3,
      },
    ],
    hints: [
      'When Frequency Penalty is 0.0, the model receives no mathematical penalty for selecting tokens it has already emitted.',
      'Min-P dynamically cuts off tokens whose probability is less than a percentage of the top candidate.',
      'Try setting Frequency Penalty to 0.6 and Min-P to 0.08, then click Generate.',
    ],
    solutionExplanation:
      'Autoregressive language models suffer from self-reinforcing probability loops when presence/frequency penalties are zero. Applying a frequency penalty reduces logits of repeated tokens, while Min-P eliminates stale tail tokens, forcing the model to select alternative semantic paths.',
  },
  {
    id: 'lab-2-rag-grounding',
    title: 'Lab 2: The RAG Grounding Defect',
    subtitle: 'Contextual Vector Grounding & Attention Alignment',
    difficulty: 'intermediate',
    badge: 'RAG Alignment',
    conceptTaught: 'Retrieval Grounding vs. Pre-Training Hallucination',
    description:
      'The prompt asks for specific account limits from an internal policy document, but high temperature and uncalibrated sampling cause the model to ignore retrieved context and hallucinate incorrect figures.',
    objective:
      'Calibrate Temperature (<= 0.5) and Min-P (>= 0.08) so the model locks onto retrieved context with > 70% grounding overlap.',
    brokenPrompt:
      'According to the provided Tier 2 Verification Policy document, what is the exact maximum daily transaction limit for Tier 2 accounts, what is the wire processing fee, and what triggers a Tier 3 compliance review?',
    ragEnabled: true,
    ragContext:
      'TIER 2 VERIFICATION POLICY:\n- Daily Transaction Ceiling: Exactly $75,000 USD.\n- Wire Processing Fee: 0.15% flat rate (discounted from standard 0.50%).\n- Compliance Escalation: Any cumulative 24-hour volume exceeding $75,000 triggers an automated Tier 3 compliance review.',
    initialParams: {
      temperature: 1.3,
      topK: 80,
      topP: 0.98,
      minP: 0.0,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
    },
    targetParamHints: [
      'Lower Temperature to between 0.2 and 0.5',
      'Increase Min-P to >= 0.08 to filter out ungrounded speculative tokens',
    ],
    verificationRules: [
      {
        id: 'rule-grounding-ratio',
        type: 'min_grounding_ratio',
        description: 'Context Grounding overlap ratio >= 70%',
        threshold: 0.7,
      },
      {
        id: 'rule-temp-calibrated',
        type: 'parameter_range',
        description: 'Temperature calibrated to <= 0.6',
        paramKey: 'temperature',
        maxVal: 0.6,
      },
    ],
    hints: [
      'Watch the cyan grounding laser beams in the visualizer. At T = 1.3, they point to dim outer asteroids.',
      'Lowering Temperature sharpens the probability peak around tokens directly mentioned in the RAG context.',
      'Set Temperature to 0.3 and Min-P to 0.10 to achieve strong grounding alignment.',
    ],
    solutionExplanation:
      'High sampling temperature flattens token logits across the entire vocabulary, allowing pre-training parametric memory to overpower retrieved prompt context. Compressing temperature and raising Min-P forces the model to stay on the high-confidence semantic plateau provided by the RAG document.',
  },
  {
    id: 'lab-3-json-stability',
    title: 'Lab 3: Structured JSON Stability',
    subtitle: 'Shannon Entropy Compression at Syntax Junctions',
    difficulty: 'intermediate',
    badge: 'Structured Output',
    conceptTaught: 'Perplexity, Shannon Entropy, & Deterministic Syntax',
    description:
      'An automated extraction pipeline is attempting to generate a valid JSON payload, but hyper-dispersed sampling entropy creates corrupted syntax, missing quotes, and invalid keys.',
    objective:
      'Compress entropy (avg < 0.6 bits at syntax boundaries) to guarantee valid JSON formatting.',
    brokenPrompt:
      'Extract the customer profile into valid JSON with keys "name", "status", and "creditScore": Customer Sarah Jenkins is currently active with an 810 credit score.',
    initialParams: {
      temperature: 1.4,
      topK: 100,
      topP: 0.99,
      minP: 0.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    },
    targetParamHints: [
      'Lower Temperature to <= 0.3 (near-greedy)',
      'Set Top-P to 0.85 or Min-P to 0.12',
    ],
    verificationRules: [
      {
        id: 'rule-max-entropy',
        type: 'max_entropy',
        description: 'Average Shannon Entropy <= 0.6 bits',
        threshold: 0.6,
      },
      {
        id: 'rule-temp-deterministic',
        type: 'parameter_range',
        description: 'Temperature set to <= 0.4',
        paramKey: 'temperature',
        maxVal: 0.4,
      },
    ],
    hints: [
      'Look at the Perplexity/Entropy indicator in the Flight Path. Red indicates high uncertainty.',
      'JSON syntax tokens ("{", ":", "}") require near-zero entropy to ensure reliable parsing.',
      'Try setting Temperature to 0.2 and Min-P to 0.15.',
    ],
    solutionExplanation:
      'Generating deterministic formats like JSON, YAML, or SQL requires extremely low entropy at syntax boundaries. Running near-greedy sampling ensures that grammar tokens are selected with near 100% confidence, preventing syntax errors in downstream software parsers.',
  },
  {
    id: 'lab-4-reasoning-xray',
    title: 'Lab 4: The Cognitive Orbit X-Ray',
    subtitle: 'Reasoning Monologue <think> Dynamics & Energy Contraction',
    difficulty: 'advanced',
    badge: 'Reasoning Dynamics',
    conceptTaught: 'Chain-of-Thought Entropy Contraction & Monologue Decoupling',
    description:
      'Explore how modern reasoning models explore candidate logical pathways within <think> monologues before contracting their probability distribution into a high-confidence answer.',
    objective:
      'Observe the cognitive asteroid cloud during the thinking stream and confirm that final token emission achieves high confidence (> 85%).',
    brokenPrompt:
      'Solve this riddle step by step: A farmer has 17 sheep, and all but 9 die. How many sheep are left alive?',
    initialParams: {
      temperature: 0.6,
      topK: 50,
      topP: 0.95,
      minP: 0.05,
      maxThinkingTokens: 128,
    },
    targetParamHints: [
      'Keep Min-P between 0.05 and 0.10',
      'Watch the transition from <think> asteroid cloud to Supergiant star at the answer',
    ],
    verificationRules: [
      {
        id: 'rule-thinking-contrast',
        type: 'thinking_contrast',
        description: 'Successful cognitive monologue parsing and high-confidence final answer',
      },
    ],
    hints: [
      'Notice that during the thinking phase, the canvas renders a diffuse outer cloud of cognitive asteroids.',
      'Once </think> is emitted, the distribution contracts into a single Supergiant star representing "9".',
      'Click Generate to observe the real-time reasoning transition.',
    ],
    solutionExplanation:
      'Reasoning models maintain high cognitive entropy while exploring candidate logical hypotheses inside <think> tags. Once the problem is solved internally, the probability manifold contracts into a steep potential well, emitting the final answer with decisive certainty.',
  },
];
