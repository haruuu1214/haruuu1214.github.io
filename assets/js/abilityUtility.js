// Shared formatting helpers used by both ability.js and talent.js, ported
// from lib/battle-cats-rolls/ability.rb's `AbilityUtility` module. These
// build small HTML snippets; `view` is a render-layer object exposing
// statTime(frames)/statRange(value)/statAugmented(stat, key, html).

export const TREASURE_MULTIPLIER = 1.2; // duration treasure multiplier
// (distinct from Stat's 2.5 treasure multiplier for health/damage)
export const RANGE_MULTIPLIER = 0.25;

export function strong(text) {
  return `<strong>${text}</strong>`;
}

export function percent(integer) {
  return strong(`${integer}%`);
}

export function highlight(text, { view, stat, qualifiedValueName } = {}) {
  const result = strong(text);
  if (stat && view) {
    return view.statAugmented(stat, qualifiedValueName, result);
  }
  return result;
}

export function percentHighlight(integer, ctx = {}) {
  return highlight(`${integer}%`, ctx);
}

export function seconds(duration, ctx = {}) {
  return strong(ctx.view.statTime(duration));
}

export function secondsWithTreasure(duration, ctx = {}) {
  const maxTime = Math.floor(duration * TREASURE_MULTIPLIER);
  const without = ctx.view.statTime(duration);
  const withT = ctx.view.statTime(maxTime);
  return `${without} or ${highlight(withT, ctx)}`;
}

export function qualifiedName(name) {
  return `ability.${name}`;
}

export function qualifiedValueName(name) {
  return qualifiedName(name).toLowerCase();
}
