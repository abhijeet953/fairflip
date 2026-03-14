import { randomBytes, toHex } from "./entropy";
import { createCommit, computeFlip } from "./commit";
import { audit } from "./audit";
import type { FlipOptions, FlipResult, BatchResult } from "./types";

export async function flip(options: FlipOptions = {}): Promise<FlipResult> {
  const timestamp = Date.now();
  const { serverSeed, serverCommitment } = await createCommit();
  const clientNonce = toHex(randomBytes(32));
  const { result, proof } = await computeFlip(serverSeed, serverCommitment, clientNonce);

  return {
    result,
    timestamp,
    proof,
    ...(options.label !== undefined && { label: options.label }),
    ...(options.includeRawEntropy && { rawEntropy: serverSeed + clientNonce }),
  };
}

export async function flipBatch(
  n: number,
  options: FlipOptions = {}
): Promise<BatchResult> {
  if (n < 1) throw new Error("[fairflip] n must be >= 1");
  if (n > 100_000) throw new Error("[fairflip] n must be <= 100,000 per call");

  const flips: FlipResult[] = [];
  for (let i = 0; i < n; i++) {
    flips.push(await flip(options));
  }

  return { flips, audit: audit(flips) };
}
