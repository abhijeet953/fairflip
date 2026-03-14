import { randomBytes, toHex } from "./entropy";
import type { CommitPair, FlipProof, CoinFace } from "./types";

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = await (globalThis as any).crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(buf);
}

async function sha256Hex(hex: string): Promise<string> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return toHex(await sha256(bytes));
}

async function sha256ConcatHex(a: string, b: string): Promise<string> {
  const aBytes = new Uint8Array(a.length / 2);
  const bBytes = new Uint8Array(b.length / 2);
  for (let i = 0; i < aBytes.length; i++) aBytes[i] = parseInt(a.slice(i * 2, i * 2 + 2), 16);
  for (let i = 0; i < bBytes.length; i++) bBytes[i] = parseInt(b.slice(i * 2, i * 2 + 2), 16);
  const combined = new Uint8Array(aBytes.length + bBytes.length);
  combined.set(aBytes, 0);
  combined.set(bBytes, aBytes.length);
  return toHex(await sha256(combined));
}

export async function createCommit(): Promise<CommitPair> {
  const serverSeed = toHex(randomBytes(32));
  const serverCommitment = await sha256Hex(serverSeed);
  return { serverSeed, serverCommitment };
}

export async function computeFlip(
  serverSeed: string,
  serverCommitment: string,
  clientNonce: string = ""
): Promise<{ result: CoinFace; proof: FlipProof }> {
  const recomputed = await sha256Hex(serverSeed);
  if (recomputed !== serverCommitment) {
    throw new Error("[fairflip] serverSeed does not match serverCommitment.");
  }

  const effectiveNonce = clientNonce.length > 0 ? clientNonce : "0".repeat(64);
  const combinedHash = await sha256ConcatHex(serverSeed, effectiveNonce);
  const firstByte = parseInt(combinedHash.slice(0, 2), 16);
  const result: CoinFace = (firstByte & 1) === 0 ? "heads" : "tails";

  return {
    result,
    proof: {
      serverCommitment,
      serverSeed,
      clientNonce: effectiveNonce,
      combinedHash,
      algorithm: "SHA-256-commit-reveal-v1",
    },
  };
}

export async function verifyProof(
  result: CoinFace,
  proof: FlipProof
): Promise<boolean> {
  try {
    if (await sha256Hex(proof.serverSeed) !== proof.serverCommitment) return false;
    if (await sha256ConcatHex(proof.serverSeed, proof.clientNonce) !== proof.combinedHash) return false;
    const firstByte = parseInt(proof.combinedHash.slice(0, 2), 16);
    const expected: CoinFace = (firstByte & 1) === 0 ? "heads" : "tails";
    return expected === result;
  } catch {
    return false;
  }
}
