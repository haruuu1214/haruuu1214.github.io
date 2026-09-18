// Port of lib/battle-cats-rolls/gacha.rb's seed advance/retreat (xorshift32,
// shift triple 13/17/15). Seeds are treated as unsigned 32-bit integers.

export const MAX_SEED = 2 ** 32;

export function normalizeSeed(input) {
  const n = Math.trunc(Math.abs(Number(input) || 0));
  return n % MAX_SEED;
}

export function advanceSeed(x) {
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 15)) >>> 0;
  return x;
}

export function retreatSeed(x) {
  x = (x ^ (x << 15)) >>> 0;
  x = (x ^ (x << 30)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x << 26)) >>> 0;
  return x;
}

export function backtrackSeed(seed, steps) {
  let x = seed;
  for (let i = 0; i < steps; i++) {
    x = retreatSeed(x);
  }
  return x;
}

// Ruby's String#to_i: parses a leading (optionally signed) run of digits,
// ignoring everything else, and returns 0 for no match (never NaN).
export function rubyToI(value) {
  if (value == null) return 0;
  const match = String(value).match(/^\s*([+-]?\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
