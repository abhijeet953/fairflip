/**
 * fairflip — Test Suite
 * Run: npx vitest run
 */

import { describe, it, expect } from "vitest";
import { flip, flipBatch, createCommit, computeFlip, verifyProof, audit } from "../src/index";
import { randomBytes, toHex, fromHex } from "../src/entropy";

// ── Entropy ────────────────────────────────────────────────────────────────

describe("entropy", () => {
  it("returns the requested number of bytes", () => {
    expect(randomBytes(16).length).toBe(16);
    expect(randomBytes(32).length).toBe(32);
    expect(randomBytes(64).length).toBe(64);
  });

  it("returns different bytes each call (probabilistic)", () => {
    const a = toHex(randomBytes(32));
    const b = toHex(randomBytes(32));
    expect(a).not.toBe(b);
  });

  it("toHex produces lowercase hex of correct length", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0xab, 0x12]);
    expect(toHex(bytes)).toBe("00ffab12");
  });

  it("fromHex round-trips with toHex", () => {
    const original = randomBytes(32);
    const hex = toHex(original);
    const restored = fromHex(hex);
    expect(Array.from(restored)).toEqual(Array.from(original));
  });
});

// ── Commit-Reveal Protocol ─────────────────────────────────────────────────

describe("commit-reveal protocol", () => {
  it("createCommit returns a 64-char hex serverSeed and serverCommitment", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    expect(serverSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(serverCommitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("serverCommitment is deterministically derived from serverSeed", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    // Re-derive commitment manually
    const enc = new TextEncoder();
    const seedBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      seedBytes[i] = parseInt(serverSeed.slice(i * 2, i * 2 + 2), 16);
    }
    const hashBuf = await crypto.subtle.digest("SHA-256", seedBytes);
    const recomputed = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(recomputed).toBe(serverCommitment);
  });

  it("computeFlip produces heads or tails", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    const { result } = await computeFlip(serverSeed, serverCommitment, "");
    expect(["heads", "tails"]).toContain(result);
  });

  it("verifyProof returns true for a valid proof", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    const clientNonce = toHex(randomBytes(32));
    const { result, proof } = await computeFlip(serverSeed, serverCommitment, clientNonce);
    const valid = await verifyProof(result, proof);
    expect(valid).toBe(true);
  });

  it("verifyProof returns false if result is tampered", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    const { result, proof } = await computeFlip(serverSeed, serverCommitment, "");
    const tampered = result === "heads" ? "tails" : "heads";
    const valid = await verifyProof(tampered, proof);
    expect(valid).toBe(false);
  });

  it("verifyProof returns false if serverSeed is tampered", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    const { result, proof } = await computeFlip(serverSeed, serverCommitment, "");
    const tamperedProof = { ...proof, serverSeed: toHex(randomBytes(32)) };
    const valid = await verifyProof(result, tamperedProof);
    expect(valid).toBe(false);
  });

  it("verifyProof returns false if combinedHash is tampered", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    const { result, proof } = await computeFlip(serverSeed, serverCommitment, "");
    const tamperedProof = { ...proof, combinedHash: toHex(randomBytes(32)) };
    const valid = await verifyProof(result, tamperedProof);
    expect(valid).toBe(false);
  });

  it("different client nonces produce independent results", async () => {
    const { serverSeed, serverCommitment } = await createCommit();
    const nonce1 = toHex(randomBytes(32));
    const nonce2 = toHex(randomBytes(32));
    const { result: r1, proof: p1 } = await computeFlip(serverSeed, serverCommitment, nonce1);
    const { result: r2, proof: p2 } = await computeFlip(serverSeed, serverCommitment, nonce2);
    // Proofs should differ
    expect(p1.combinedHash).not.toBe(p2.combinedHash);
    // Both should verify
    expect(await verifyProof(r1, p1)).toBe(true);
    expect(await verifyProof(r2, p2)).toBe(true);
  });
});

// ── flip() ─────────────────────────────────────────────────────────────────

describe("flip()", () => {
  it("returns heads or tails", async () => {
    const { result } = await flip();
    expect(["heads", "tails"]).toContain(result);
  });

  it("includes a valid proof", async () => {
    const { result, proof } = await flip();
    expect(await verifyProof(result, proof)).toBe(true);
  });

  it("includes a timestamp", async () => {
    const before = Date.now();
    const { timestamp } = await flip();
    const after = Date.now();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("includes label when provided", async () => {
    const { label } = await flip({ label: "test-flip" });
    expect(label).toBe("test-flip");
  });

  it("includes rawEntropy when requested", async () => {
    const { rawEntropy } = await flip({ includeRawEntropy: true });
    expect(rawEntropy).toMatch(/^[0-9a-f]{128}$/); // 64 bytes total
  });

  it("produces independent results across calls", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => flip()));
    const proofs = results.map((r) => r.proof.combinedHash);
    const unique = new Set(proofs);
    expect(unique.size).toBe(10); // all unique
  });
});

// ── flipBatch() ────────────────────────────────────────────────────────────

describe("flipBatch()", () => {
  it("returns correct count of flips", async () => {
    const { flips } = await flipBatch(10);
    expect(flips.length).toBe(10);
  });

  it("throws for n < 1", async () => {
    await expect(flipBatch(0)).rejects.toThrow();
  });

  it("all flips in batch have valid proofs", async () => {
    const { flips } = await flipBatch(20);
    for (const f of flips) {
      expect(await verifyProof(f.result, f.proof)).toBe(true);
    }
  });

  it("audit report has correct totals", async () => {
    const { flips, audit: report } = await flipBatch(50);
    expect(report.total).toBe(50);
    expect(report.heads + report.tails).toBe(50);
  });
});

// ── Statistical audit ──────────────────────────────────────────────────────

describe("audit()", () => {
  it("returns insufficient-data for < 5 flips", async () => {
    const { flips } = await flipBatch(3);
    const report = audit(flips);
    expect(report.verdict).toBe("insufficient-data");
  });

  it("passes chi-squared for a large fair sample", async () => {
    const { flips } = await flipBatch(500);
    const report = audit(flips);
    // p-value should be > 0.05 for a fair CSPRNG with overwhelming probability
    // We use a loose check here since it's probabilistic
    expect(report.chiSquared).toBeLessThan(20); // extremely generous upper bound
    expect(report.total).toBe(500);
  });

  it("correctly detects a biased sequence", () => {
    // Construct a heavily biased sequence (95% heads)
    const biasedFlips = Array.from({ length: 200 }, (_, i) => ({
      result: (i % 20 === 0 ? "tails" : "heads") as "heads" | "tails",
      timestamp: Date.now(),
      proof: {
        serverCommitment: "a".repeat(64),
        serverSeed: "b".repeat(64),
        clientNonce: "0".repeat(64),
        combinedHash: "c".repeat(64),
        algorithm: "SHA-256-commit-reveal-v1" as const,
      },
    }));
    const report = audit(biasedFlips);
    expect(report.verdict).toBe("fail");
    expect(report.chiSquared).toBeGreaterThan(3.841); // reject at α=0.05
  });

  it("headsRatio is computed correctly", () => {
    const fakeFlips = [
      ...Array(3).fill(null).map(() => ({
        result: "heads" as const, timestamp: 0,
        proof: { serverCommitment: "a".repeat(64), serverSeed: "b".repeat(64), clientNonce: "0".repeat(64), combinedHash: "c".repeat(64), algorithm: "SHA-256-commit-reveal-v1" as const }
      })),
      ...Array(7).fill(null).map(() => ({
        result: "tails" as const, timestamp: 0,
        proof: { serverCommitment: "a".repeat(64), serverSeed: "b".repeat(64), clientNonce: "0".repeat(64), combinedHash: "c".repeat(64), algorithm: "SHA-256-commit-reveal-v1" as const }
      })),
    ];
    const report = audit(fakeFlips);
    expect(report.heads).toBe(3);
    expect(report.tails).toBe(7);
    expect(report.headsRatio).toBeCloseTo(0.3, 5);
  });
});
