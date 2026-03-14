# fairflip

A cryptographically fair, verifiable coin flip library. Zero dependencies. Works in Node.js, browsers, and Deno.

## Install

```bash
npm install fairflip
```

## Usage

### Basic flip

```ts
import { flip, verifyProof } from "fairflip";

const { result, proof } = await flip();
console.log(result); // "heads" or "tails"

// Verify the result independently
const valid = await verifyProof(result, proof);
console.log(valid); // true
```

### Flip with a label

```ts
const { result } = await flip({ label: "game-round-1" });
```

### Batch flips with statistical audit

```ts
import { flipBatch } from "fairflip";

const { flips, audit } = await flipBatch(1000);
console.log(audit.verdict);    // "pass" | "fail" | "insufficient-data"
console.log(audit.chiSquared); // test statistic
console.log(audit.pValue);     // > 0.05 means fair at 95% confidence
```

### Two-party commit-reveal (multiplayer)

Neither side can manipulate the outcome.

```ts
import { createCommit, computeFlip, verifyProof } from "fairflip";

// Server: generate commitment before seeing client nonce
const { serverSeed, serverCommitment } = await createCommit();
// → send serverCommitment to client

// Client: send their nonce after seeing commitment
const clientNonce = "...32 random bytes as hex...";

// Server: compute result and reveal
const { result, proof } = await computeFlip(serverSeed, serverCommitment, clientNonce);

// Anyone: verify
const valid = await verifyProof(result, proof); // true
```

### Replace Math.random() globally

```ts
import "fairflip/shim";

// Math.random() now uses a CSPRNG everywhere in your app
Math.random();
```

### Human-readable proof report

```ts
import { verifyWithReport } from "fairflip";

const result = await flip();
console.log(await verifyWithReport(result));
```

```
═══════════════════════════════════════════
  fairflip — Proof Verification Report
═══════════════════════════════════════════
  Result   : HEADS
  Timestamp: 2025-01-01T00:00:00.000Z
  Algorithm: SHA-256-commit-reveal-v1

  Verification steps:
  [✓] Step 1: SHA-256(serverSeed) == serverCommitment
  [✓] Step 2: SHA-256(serverSeed ‖ clientNonce) == combinedHash
  [✓] Step 3: LSB(combinedHash) matches result

  VERDICT: ✓ VALID — proof is cryptographically sound
═══════════════════════════════════════════
```

## Running tests

```bash
cd packages/core
npm install
npx vitest run
```

## How it works

Each flip generates a random server seed, commits to it via `SHA-256(seed)`, then combines it with a client nonce: `SHA-256(seed ‖ nonce)`. The result is derived from the LSB of that hash. The proof lets anyone verify the outcome without trusting the server.

See `MATH_PROOF.md` for the formal proofs.

## License

MIT 
