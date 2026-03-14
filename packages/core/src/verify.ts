import { verifyProof } from "./commit";
import type { FlipResult } from "./types";

export { verifyProof };

export async function verifyWithReport(flipResult: FlipResult): Promise<string> {
  const { result, proof, timestamp, label } = flipResult;

  const crypto = (globalThis as any).crypto;

  const toBytes = (hex: string) => {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return b;
  };

  const sha256hex = async (bytes: Uint8Array) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  let step1 = false, step2 = false, step3 = false;

  try {
    step1 = (await sha256hex(toBytes(proof.serverSeed))) === proof.serverCommitment;

    const s = toBytes(proof.serverSeed);
    const n = toBytes(proof.clientNonce);
    const combined = new Uint8Array(s.length + n.length);
    combined.set(s); combined.set(n, s.length);
    step2 = (await sha256hex(combined)) === proof.combinedHash;

    const firstByte = parseInt(proof.combinedHash.slice(0, 2), 16);
    step3 = ((firstByte & 1) === 0 ? "heads" : "tails") === result;
  } catch { /* verification failed */ }

  const lines = [
    "═══════════════════════════════════════════",
    "  fairflip — Proof Verification Report",
    "═══════════════════════════════════════════",
    `  Result   : ${result.toUpperCase()}`,
    `  Timestamp: ${new Date(timestamp).toISOString()}`,
    ...(label ? [`  Label    : ${label}`] : []),
    `  Algorithm: ${proof.algorithm}`,
    "",
    "  Proof components:",
    `  serverCommitment : ${proof.serverCommitment}`,
    `  serverSeed       : ${proof.serverSeed}`,
    `  clientNonce      : ${proof.clientNonce}`,
    `  combinedHash     : ${proof.combinedHash}`,
    "",
    "  Verification steps:",
    `  [${step1 ? "✓" : "✗"}] Step 1: SHA-256(serverSeed) == serverCommitment`,
    `  [${step2 ? "✓" : "✗"}] Step 2: SHA-256(serverSeed ‖ clientNonce) == combinedHash`,
    `  [${step3 ? "✓" : "✗"}] Step 3: LSB(combinedHash) matches result`,
    "",
    `  VERDICT: ${step1 && step2 && step3 ? "✓ VALID — proof is cryptographically sound" : "✗ INVALID — proof failed verification"}`,
    "═══════════════════════════════════════════",
  ];

  return lines.join("\n");
}
