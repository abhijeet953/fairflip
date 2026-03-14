# fairflip — Mathematical Proof of Fairness

## Overview

This document provides formal mathematical proofs for the three correctness
guarantees of the fairflip commit-reveal protocol:

1. **Unbiasedness** — Each flip is exactly Bernoulli(1/2)
2. **Server-binding** — The server cannot change the outcome after committing
3. **Client-independence** — The client cannot bias the outcome via nonce choice

---

## Definitions

Let:

| Symbol | Definition |
|--------|-----------|
| `H : {0,1}* → {0,1}^256` | SHA-256, modelled as a random oracle |
| `s ∈ {0,1}^256` | Server seed — sampled uniformly from CSPRNG |
| `n ∈ {0,1}^256` | Client nonce — sampled uniformly from CSPRNG |
| `c = H(s)` | Server commitment — published before client nonce |
| `v = H(s ‖ n)` | Combined value — computed at flip time |
| `r = LSB(v[0])` | Result bit — LSB of first byte of v |
| `result = r == 0 ? "heads" : "tails"` | Final outcome |

---

## Theorem 1 — The flip is unbiased (Pr[heads] = Pr[tails] = 1/2)

**Proof:**

Since s is sampled uniformly from {0,1}^256 by a CSPRNG, and n is sampled
uniformly from {0,1}^256 independently:

```
(s, n) is uniform over {0,1}^256 × {0,1}^256
```

The concatenation (s ‖ n) is uniform over {0,1}^512.

Under the random oracle model, H(s ‖ n) is uniformly distributed over
{0,1}^256 for any distinct input.

The result bit r is the least significant bit (LSB) of the first byte of
H(s ‖ n). For a uniform distribution over {0,1}^256, each bit is
independently and uniformly distributed over {0, 1}.

Therefore:

```
Pr[r = 0] = Pr[r = 1] = 1/2
```

Which gives us:

```
Pr[result = "heads"] = Pr[result = "tails"] = 1/2  ∎
```

---

## Theorem 2 — Server cannot manipulate outcome after commitment

**Claim:** Once the server publishes c = H(s), it cannot produce a different
seed s' ≠ s such that the flip would yield a different result, without being
detected.

**Proof:**

Assume for contradiction that after publishing c = H(s), the server can find
s' such that:

```
H(s') = c = H(s)  and  s' ≠ s
```

This would constitute a hash collision in SHA-256, which is computationally
infeasible by the collision-resistance property of SHA-256:

```
Pr[A finds (s, s') : H(s) = H(s'), s ≠ s'] < negl(λ)
```

where negl(λ) is a negligible function in the security parameter λ = 256.

The best known collision attack on SHA-256 requires O(2^128) work (birthday
bound). This is computationally infeasible with current or foreseeable hardware.

Therefore, once c is published, s is effectively fixed. Since v = H(s ‖ n) is
uniquely determined by s (given n from the client), the result r = LSB(v[0])
is fixed at commitment time.

**Corollary:** The server cannot change the result after seeing the client
nonce, because doing so would require either:
1. Finding a collision in SHA-256, or
2. Finding a different s' that produces the same commitment AND a different
   result when combined with the client's nonce — which is even harder,
   as it requires a second preimage with specific LSB properties. ∎

---

## Theorem 3 — Client cannot bias the outcome via nonce choice

**Claim:** Even if the client chooses their nonce n adversarially after seeing
the server commitment c = H(s), they cannot bias the result.

**Proof:**

The client sees c = H(s) but not s. Under the random oracle model, c reveals
no information about s:

```
H(I(c)) ⊥ s   (c is computationally independent of s for any PPT inverter I)
```

This follows from the preimage resistance of SHA-256:

```
Pr[A(H(s)) finds s' : H(s') = H(s)] < negl(λ)
```

Since the client cannot recover s from c, and v = H(s ‖ n), the combined
value v is uniform over {0,1}^256 from the client's perspective regardless
of their choice of n:

For any fixed n chosen by the client:
```
v = H(s ‖ n) is uniform over {0,1}^256 (by random oracle + uniform s)
```

Therefore r = LSB(v[0]) is Bernoulli(1/2) regardless of n.

**Intuition:** The client is trying to bias a coin where the server has
secretly pre-flipped it (at commitment time) and only revealed the sealed
envelope. Without breaking SHA-256's preimage resistance, the client cannot
know which way the coin is currently facing. ∎

---

## Theorem 4 — Independence across flips

**Claim:** The results of separate flip calls are mutually independent.

**Proof:**

Each call to `flip()` generates:
- A fresh s_i ~ Uniform({0,1}^256) via CSPRNG
- A fresh n_i ~ Uniform({0,1}^256) via CSPRNG

By the security definition of a CSPRNG (computational pseudorandomness):
```
(s_1, n_1, s_2, n_2, ..., s_k, n_k) is computationally indistinguishable
from k pairs of independently uniform random variables
```

Therefore (s_i ‖ n_i) are independent for each i.

Under the random oracle model, v_i = H(s_i ‖ n_i) are independent and
uniform, so r_i = LSB(v_i[0]) are i.i.d. Bernoulli(1/2). ∎

---

## Statistical Tests

### Chi-Squared Goodness-of-Fit Test

**H₀:** P(heads) = P(tails) = 0.5

**Test statistic:**
```
χ² = (H - n/2)² / (n/2) + (T - n/2)² / (n/2)
```

where H = heads count, T = tails count, n = total flips.

**Degrees of freedom:** df = k - 1 = 1

**Critical value at α = 0.05:** χ²_crit = 3.841

**Decision rule:**
```
χ² ≤ 3.841  →  fail to reject H₀  →  coin appears fair
χ² > 3.841  →  reject H₀          →  coin appears biased
```

**p-value:**
```
p = erfc(√(χ²/2) / √2)
```

where erfc is the complementary error function.

### NIST SP 800-22 Frequency (Monobit) Test

Encode: heads → +1, tails → -1

```
S_n = Σᵢ xᵢ
s_obs = |S_n| / √n
p-value = erfc(s_obs / √2)
```

**Decision:** p ≥ 0.01 → PASS

### Runs Test (NIST SP 800-22, Section 2.3)

A run is a maximal sequence of identical outcomes.

**Pre-test:** |p̂ - 0.5| < 2/√n (frequency must be close to 0.5)

**Expected runs:**
```
E[R] = 1 + 2n·p̂·(1-p̂)
```

**Variance:**
```
Var[R] = 2n·p̂·(1-p̂)·(2n·p̂·(1-p̂) - 1) / (n - 1)
```

**Test statistic:**
```
z = (R - E[R]) / √Var[R]
p-value = erfc(|z| / √2)
```

**Decision:** p ≥ 0.01 → PASS

---

## Security Assumptions

This protocol's security rests on:

| Assumption | Standard Name | Confidence |
|-----------|--------------|-----------|
| SHA-256 is collision-resistant | CR-Hash | Very high — no known practical attack |
| SHA-256 is preimage-resistant | OW-Hash | Very high — no known practical attack |
| SHA-256 behaves as a random oracle | ROM | Standard model assumption |
| CSPRNG output is computationally indistinguishable from uniform | PRG security | Satisfied by OS entropy pool (Linux /dev/urandom, Windows BCryptGenRandom) |

---

## Why Math.random() Fails These Theorems

The xorshift128+ PRNG used in V8 (and equivalents in SpiderMonkey, JSC):

1. **Fails Theorem 1 (unbiasedness):** The 128-bit state is small enough that:
   - State recovery requires only 3 observations (recent result, 2025)
   - Once state is recovered, all future outputs are perfectly predictable
   - An adversary knowing the state can predict r_i for all future i

2. **Fails Theorem 4 (independence):** xorshift128+ output is a deterministic
   function of its internal state. Flips are not independent — they follow
   a predictable sequence with period 2^128 - 1.

3. **Has no commit-reveal mechanism:** There is no way to construct a
   verifiable proof of fairness from Math.random() output, as the sequence
   is not tied to any committed seed.

---

## References

1. Bartoš et al. (2023). "Heads or Tails: The Influence of a Coin's Angularity
   on the Chance of Landing Heads." *arXiv:2310.04153*

2. Diaconis, Holmes & Montgomery (2007). "Dynamical Bias in the Coin Toss."
   *SIAM Review 49(2), 211-235.*

3. Micali, Rabin & Vadhan (1999). "Verifiable Random Functions."
   *FOCS 1999, pp. 120-130.*

4. NIST SP 800-22 Rev 1a (2010). "A Statistical Test Suite for Random and
   Pseudorandom Number Generators for Cryptographic Applications."

5. NIST SP 800-90A (2015). "Recommendation for Random Number Generation
   Using Deterministic Random Bit Generators."

6. V8 Blog (2015). "There's Math.random(), and then there's Math.random()."
   *v8.dev/blog/math-random*

7. Klyuchnikov (2025). "Cracking Math.random() with only 3 outputs."
   Blog post demonstrating state recovery from 3 xorshift128+ outputs.
