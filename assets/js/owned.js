// Port of lib/battle-cats-rolls/owned.rb: encode/decode a Set of owned cat
// IDs as a base62 string of an arbitrary-precision bitset. Cat IDs run into
// the hundreds, so this must use BigInt, not Number.
//
// The legacy zlib+base64 `owned` (old-format) decode path is intentionally
// NOT ported: this is a brand-new site with fresh URLs, so there are no old
// bookmarked links to stay compatible with.

const DIGITS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = 62n;

export function encode(catIds) {
  const uniqueIds = [...new Set(catIds)];
  if (uniqueIds.length === 0) return "";

  let int = 0n;
  for (const id of uniqueIds) {
    int += 1n << BigInt(id);
  }

  return toRadix(int);
}

export function decode(code) {
  if (typeof code !== "string" || !/^[0-9A-Za-z]+$/.test(code)) return [];

  let int = fromRadix(code);
  if (int === 0n) return [];

  const ids = [];
  let id = 0;
  while (int > 0n) {
    if (int & 1n) ids.push(id);
    int >>= 1n;
    id++;
  }
  return ids;
}

function toRadix(int) {
  const digits = [];
  let n = int;
  do {
    digits.push(DIGITS[Number(n % BASE)]);
    n /= BASE;
  } while (n > 0n);
  return digits.reverse().join("");
}

function fromRadix(code) {
  let int = 0n;
  let place = 1n;
  for (let i = code.length - 1; i >= 0; i--) {
    const value = DIGITS.indexOf(code[i]);
    int += BigInt(value) * place;
    place *= BASE;
  }
  return int;
}
