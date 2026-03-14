import type { EntropySource } from "./types";

export type { EntropySource };

export function getEntropySource(): EntropySource {
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).crypto !== "undefined" &&
    typeof (globalThis as any).crypto.getRandomValues === "function"
  ) {
    return (byteCount: number) => {
      const buf = new Uint8Array(byteCount);
      (globalThis as any).crypto.getRandomValues(buf);
      return buf;
    };
  }

  try {
    const nodeCrypto = require("crypto");
    if (nodeCrypto && typeof nodeCrypto.randomBytes === "function") {
      return (byteCount: number) => {
        const buf: Buffer = nodeCrypto.randomBytes(byteCount);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      };
    }
  } catch {
    // not Node.js
  }

  throw new Error(
    "[fairflip] No cryptographic entropy source found. " +
    "Requires crypto.getRandomValues() or node:crypto. " +
    "fairflip never falls back to Math.random()."
  );
}

export const defaultEntropy: EntropySource = getEntropySource();

export function randomBytes(n: number): Uint8Array {
  return defaultEntropy(n);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string length");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
