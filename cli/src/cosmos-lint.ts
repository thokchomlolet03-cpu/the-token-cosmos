#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { evaluatePromptTokens, verifyWebGPUAdapter, TokenInput } from './engine/headlessSampling';
import { renderTerminalReport } from './reporters/terminalReporter';
import { KeyringManager } from './auth/keyringManager';

const SAMPLE_BENCHMARK_PROMPTS = [
  {
    name: 'Customer Service Loop Trap',
    prompt: 'Please verify your account details. For your security, please verify your account number. To proceed, please verify your account number and confirm your details. Please verify your account',
    tokens: [
      { token_str: 'Please', raw_logit: 8.5 },
      { token_str: ' verify', raw_logit: 9.1 },
      { token_str: ' your', raw_logit: 9.4 },
      { token_str: ' account', raw_logit: 9.6 },
      { token_str: ' details', raw_logit: 7.8 },
      { token_str: '.', raw_logit: 9.8 },
      { token_str: ' For', raw_logit: 7.2 },
      { token_str: ' your', raw_logit: 8.9 },
      { token_str: ' security', raw_logit: 8.6 },
      { token_str: ',', raw_logit: 9.2 },
      { token_str: ' please', raw_logit: 9.5 },
      { token_str: ' verify', raw_logit: 9.9 },
      { token_str: ' your', raw_logit: 9.9 },
      { token_str: ' account', raw_logit: 9.9 },
      { token_str: ' number', raw_logit: 8.4 },
      { token_str: '.', raw_logit: 9.8 },
      { token_str: ' To', raw_logit: 6.8 },
      { token_str: ' proceed', raw_logit: 8.1 },
      { token_str: ',', raw_logit: 9.1 },
      { token_str: ' please', raw_logit: 9.8 },
      { token_str: ' verify', raw_logit: 9.9 },
      { token_str: ' your', raw_logit: 9.9 },
      { token_str: ' account', raw_logit: 9.9 },
      { token_str: ' number', raw_logit: 8.5 },
    ],
  },
];

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
\x1b[1m\x1b[36m🌌 THE TOKEN COSMOS — Zero-Egress Prompt Linter CLI (cosmos-lint)\x1b[0m

\x1b[1mUSAGE:\x1b[0m
  $ cosmos-lint [options]

\x1b[1mOPTIONS:\x1b[0m
  --sample                Run linter on built-in enterprise benchmark scenarios
  --prompt <string>       Evaluate a raw prompt text string
  --prompts <file.json>   Evaluate a JSON file containing prompts and candidate tokens
  --min-p <number>        Target Min-P threshold for cutoff evaluation (default: 0.05)
  --output <table|json>   Output display format (default: table)
  --check-gpu             Verify local WebGPU hardware availability and Direct3D12/Vulkan passthrough
  --auth                  Authenticate developer session via OAuth 2.0 Device Flow (RFC 8628)
  --logout                Revoke stored credentials
  --help, -h              Display this help manual

\x1b[1mEXAMPLES:\x1b[0m
  $ cosmos-lint --sample
  $ cosmos-lint --prompt "Extract customer id into JSON schema" --min-p 0.08
  $ cosmos-lint --prompts ./prompts.json --output json > report.json
  $ cosmos-lint --check-gpu
  $ cosmos-lint --auth
`);
    process.exit(0);
  }

  // Handle Authentication Flow
  if (args.includes('--auth')) {
    await KeyringManager.startDeviceAuthFlow();
    process.exit(0);
  }

  // Handle Logout
  if (args.includes('--logout')) {
    KeyringManager.clearToken();
    console.log('✔ Stored credentials successfully cleared.');
    process.exit(0);
  }

  // Handle GPU Check
  if (args.includes('--check-gpu')) {
    console.log('🔍 Inspecting local graphics hardware adapter...');
    const result = await verifyWebGPUAdapter();
    if (result.available) {
      console.log('\x1b[32m✔ WebGPU hardware adapter active and operational!\x1b[0m');
    } else {
      console.log(`\x1b[33m${result.error}\x1b[0m`);
    }
    process.exit(0);
  }

  // Min-P argument
  let userMinP = 0.05;
  const minPIdx = args.indexOf('--min-p');
  if (minPIdx !== -1 && args[minPIdx + 1]) {
    userMinP = parseFloat(args[minPIdx + 1]) || 0.05;
  }

  // Output format
  const isJson = args.includes('--output') && args[args.indexOf('--output') + 1] === 'json';

  // Benchmark / Sample Evaluation
  if (args.includes('--sample')) {
    const sample = SAMPLE_BENCHMARK_PROMPTS[0];
    const report = evaluatePromptTokens(sample.tokens, sample.prompt, userMinP);

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      renderTerminalReport(report);
    }
    process.exit(0);
  }

  // Custom Prompt evaluation
  const promptIdx = args.indexOf('--prompt');
  if (promptIdx !== -1 && args[promptIdx + 1]) {
    const promptText = args[promptIdx + 1];
    console.log('\x1b[33mℹ Running Structural Token Friction Analysis on text input...\x1b[0m');
    console.log('\x1b[90m(For deep neural forward-pass logits, supply pre-recorded candidates via --prompts or launch the WebGPU Studio.)\x1b[0m\n');
    
    const words = promptText.split(/\s+/);
    const tokens: TokenInput[] = words.map((word: string, i: number) => ({
      token_str: (i === 0 ? '' : ' ') + word,
      raw_logit: 8.0 + (word.length > 6 ? 1.5 : -0.5),
    }));

    const report = evaluatePromptTokens(tokens, promptText, userMinP);

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      renderTerminalReport(report);
    }
    process.exit(0);
  }

  // Prompts JSON file evaluation
  const fileIdx = args.indexOf('--prompts');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    const filePath = path.resolve(process.cwd(), args[fileIdx + 1]);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: File not found at path: ${filePath}`);
      process.exit(1);
    }

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const items = Array.isArray(content) ? content : [content];

      const reports = items.map((item: any) => {
        const pText = item.prompt || item.text || 'Prompt input';
        const toks: TokenInput[] = item.tokens || pText.split(/\s+/).map((w: string) => ({ token_str: w, raw_logit: 7.5 }));
        return evaluatePromptTokens(toks, pText, userMinP);
      });

      if (isJson) {
        console.log(JSON.stringify(reports, null, 2));
      } else {
        reports.forEach((r) => renderTerminalReport(r));
      }
    } catch (err: any) {
      console.error(`❌ Error parsing JSON prompt file: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  console.log('❌ No valid command provided. Use --help to view options.');
  process.exit(1);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
