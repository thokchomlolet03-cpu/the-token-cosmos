import { PromptLintReport } from '../engine/headlessSampling';

// ANSI Terminal Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BG_DARK = '\x1b[40m';

export function renderTerminalReport(report: PromptLintReport): void {
  console.log('\n' + BOLD + CYAN + '══════════════════════════════════════════════════════════════════════════════════' + RESET);
  console.log(BOLD + CYAN + '  🌌 THE TOKEN COSMOS — Zero-Egress Prompt Linter & Friction Hunter' + RESET);
  console.log(DIM + '  Hardware: 100% Client-Side Local Compute • Sovereign Data Integrity' + RESET);
  console.log(BOLD + CYAN + '══════════════════════════════════════════════════════════════════════════════════' + RESET);

  console.log(`\n${BOLD}Target Prompt:${RESET} "${report.promptSnippet}"`);
  console.log(`${DIM}Evaluated at: ${new Date(report.evaluationTimestamp).toISOString()}${RESET}\n`);

  // Summary Metrics Table
  console.log(BOLD + '┌───────────────────────────────────┬───────────────────────────────────┐' + RESET);
  console.log(`│ Total Tokens Analyzed:  ${CYAN + String(report.totalTokens).padEnd(9) + RESET} │ Friction Points Flagged: ${
    (report.frictionPoints.length > 0 ? RED : GREEN) + String(report.frictionPoints.length).padEnd(9) + RESET
  } │`);
  console.log(`│ Avg Shannon Entropy:    ${YELLOW + (report.avgEntropy.toFixed(2) + ' bits').padEnd(9) + RESET} │ Projected Token Bloat Cut:${GREEN + (report.estimatedCostReductionPct + '%').padEnd(9) + RESET} │`);
  console.log(`│ Recommended Min-P:      ${CYAN + report.recommendedMinP.toFixed(2).padEnd(9) + RESET} │ Recommended Freq Penalty: ${CYAN + report.recommendedFrequencyPenalty.toFixed(2).padEnd(9) + RESET} │`);
  console.log(BOLD + '└───────────────────────────────────┴───────────────────────────────────┘' + RESET);

  // Friction Points Breakdown
  if (report.frictionPoints.length === 0) {
    console.log(`\n${GREEN}✔ Zero critical friction points detected! Sampling distribution is stable and well-grounded.${RESET}\n`);
  } else {
    console.log(`\n${BOLD + YELLOW}⚠ Flagged Token Friction Anomaly Breakdown:${RESET}\n`);
    console.log(
      BOLD +
      'Index  Token String           Prob      σ-Distance  Severity    Recommended Action' +
      RESET
    );
    console.log(DIM + '──────────────────────────────────────────────────────────────────────────────────────────' + RESET);

    report.frictionPoints.forEach((fp) => {
      const idxStr = String(fp.tokenIndex).padEnd(6);
      const tokStr = `"${fp.tokenStr.trim()}"`.padEnd(22);
      const probStr = `${(fp.probability * 100).toFixed(1)}%`.padEnd(9);
      const sigmaStr = `+${fp.sigmaDistance.toFixed(1)}σ`.padEnd(11);

      let sevColor = YELLOW;
      if (fp.severity === 'critical') sevColor = RED;
      if (fp.severity === 'high') sevColor = MAGENTA;
      if (fp.severity === 'low') sevColor = GREEN;
      const sevStr = sevColor + fp.severity.toUpperCase().padEnd(11) + RESET;

      console.log(`${idxStr} ${tokStr} ${probStr} ${sigmaStr} ${sevStr} ${fp.recommendation}`);
    });
  }

  // Recommended Calibration Summary
  console.log('\n' + BOLD + '🛠 Recommended Sampling Profile:' + RESET);
  console.log(`  ${CYAN}--min-p ${report.recommendedMinP.toFixed(2)}${RESET}           (Prunes speculative probability drops below ${Math.round(report.recommendedMinP * 100)}% of top star)`);
  console.log(`  ${CYAN}--frequency-penalty ${report.recommendedFrequencyPenalty.toFixed(2)}${RESET} (Prevents autoregressive recursive loop traps)`);
  console.log(`  ${GREEN}Estimated ROI:${RESET} Eliminates ~${report.estimatedCostReductionPct}% redundant tokens in downstream API calls.`);
  console.log(BOLD + CYAN + '══════════════════════════════════════════════════════════════════════════════════\n' + RESET);
}
