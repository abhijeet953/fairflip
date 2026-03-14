import type { AuditReport, FlipResult, NistTestResult, RunsTestResult } from "./types";

// erfc approximation — Abramowitz & Stegun 7.1.26, max error < 1.5e-7
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * x);
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return p * Math.exp(-(x * x));
}

function chiSquaredPValue(chiSq: number): number {
  if (chiSq <= 0) return 1;
  return erfc(Math.sqrt(chiSq / 2) / Math.sqrt(2));
}

function nistFrequencyTest(results: Array<"heads" | "tails">): NistTestResult {
  const n = results.length;
  if (n < 100) return { passed: false, pValue: 0, description: "Need at least 100 flips." };

  const sn = results.reduce((sum, r) => sum + (r === "heads" ? 1 : -1), 0);
  const pValue = erfc(Math.abs(sn) / Math.sqrt(n) / Math.sqrt(2));
  const passed = pValue >= 0.01;
  return { passed, pValue, description: `${passed ? "PASS" : "FAIL"} — p-value ${pValue.toFixed(4)}` };
}

function runsTest(results: Array<"heads" | "tails">): RunsTestResult {
  const n = results.length;
  const heads = results.filter((r) => r === "heads").length;
  const pHat = heads / n;

  if (Math.abs(pHat - 0.5) >= 2 / Math.sqrt(n)) {
    return { passed: false, runsCount: 0, expectedRuns: 0, zScore: 0, pValue: 0, description: "Pre-test failed: frequency too far from 0.5." };
  }

  let runsCount = 1;
  for (let i = 1; i < n; i++) if (results[i] !== results[i - 1]) runsCount++;

  const pi = pHat * (1 - pHat);
  const expectedRuns = 1 + 2 * n * pi;
  const variance = (2 * n * pi * (2 * n * pi - 1)) / (n - 1);

  if (variance <= 0) return { passed: false, runsCount, expectedRuns, zScore: 0, pValue: 0, description: "Zero variance." };

  const zScore = (runsCount - expectedRuns) / Math.sqrt(variance);
  const pValue = erfc(Math.abs(zScore) / Math.sqrt(2));
  const passed = pValue >= 0.01;
  return { passed, runsCount, expectedRuns: Math.round(expectedRuns), zScore, pValue, description: `${passed ? "PASS" : "FAIL"} — ${runsCount} runs, p-value ${pValue.toFixed(4)}` };
}

export function audit(results: FlipResult[]): AuditReport {
  const n = results.length;
  const heads = results.filter((r) => r.result === "heads").length;
  const tails = n - heads;

  if (n < 5) {
    return { total: n, heads, tails, headsRatio: heads / n, chiSquared: 0, pValue: 1, nistFrequencyTest: { passed: false, pValue: 0, description: "Need at least 100 flips for NIST test." }, runsTest: { passed: false, runsCount: 0, expectedRuns: 0, zScore: 0, pValue: 0, description: "Insufficient data." }, verdict: "insufficient-data" };
  }

  const expected = n / 2;
  const chiSquared = Math.pow(heads - expected, 2) / expected + Math.pow(tails - expected, 2) / expected;
  const pValue = chiSquaredPValue(chiSquared);
  const nist = nistFrequencyTest(results.map((r) => r.result));
  const runs = runsTest(results.map((r) => r.result));

  let verdict: AuditReport["verdict"] = "insufficient-data";
  if (n >= 100) {
    verdict = pValue > 0.05 && nist.passed && runs.passed ? "pass" : "fail";
  } else {
    verdict = pValue > 0.05 ? "pass" : "fail";
  }

  return { total: n, heads, tails, headsRatio: heads / n, chiSquared, pValue, nistFrequencyTest: nist, runsTest: runs, verdict };
}
