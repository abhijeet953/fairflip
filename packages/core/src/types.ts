export type CoinFace = "heads" | "tails";

export type EntropySource = (byteCount: number) => Uint8Array;

export interface FlipOptions {
  label?: string;
  includeRawEntropy?: boolean;
}

export interface CommitPair {
  serverSeed: string;
  serverCommitment: string;
}

export interface FlipProof {
  serverCommitment: string;
  serverSeed: string;
  clientNonce: string;
  combinedHash: string;
  algorithm: "SHA-256-commit-reveal-v1";
}

export interface FlipResult {
  result: CoinFace;
  timestamp: number;
  proof: FlipProof;
  label?: string;
  rawEntropy?: string;
}

export interface BatchResult {
  flips: FlipResult[];
  audit: AuditReport;
}

export interface AuditReport {
  total: number;
  heads: number;
  tails: number;
  headsRatio: number;
  chiSquared: number;
  pValue: number;
  nistFrequencyTest: NistTestResult;
  runsTest: RunsTestResult;
  verdict: "pass" | "fail" | "insufficient-data";
}

export interface NistTestResult {
  passed: boolean;
  pValue: number;
  description: string;
}

export interface RunsTestResult {
  passed: boolean;
  runsCount: number;
  expectedRuns: number;
  zScore: number;
  pValue: number;
  description: string;
}
