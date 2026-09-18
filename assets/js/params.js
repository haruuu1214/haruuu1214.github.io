// URL query-param helpers replacing route.rb's Route/Request coercion
// primitives. The static site keeps state in the URL query string (so
// links stay shareable/bookmarkable, like the original) but updates it via
// history.replaceState instead of a server-side 302 redirect.

import { rubyToI } from "./rng.js";

export function currentParams() {
  return new URLSearchParams(location.search);
}

// Ruby's params_coercion_with_nil: last-value-wins on a repeated key,
// nil (not "") when absent.
export function strOrNil(usp, key) {
  const all = usp.getAll(key);
  if (all.length === 0) return null;
  return all[all.length - 1];
}

export function intOrNil(usp, key) {
  const s = strOrNil(usp, key);
  return s == null ? null : rubyToI(s);
}

// Ruby's params_coercion: same, but always coerces (nil -> "" -> 0 or "").
export function strOr(usp, key) {
  return strOrNil(usp, key) ?? "";
}

export function intOr(usp, key) {
  return rubyToI(strOrNil(usp, key));
}

// Ruby's params_coercion_true_or_nil: true if present & non-whitespace,
// else nil (so it can be omitted entirely from a rebuilt query string).
export function boolOrNil(usp, key) {
  const s = strOrNil(usp, key);
  return s != null && /\S/.test(s) ? true : null;
}

export function arrayParam(usp, key) {
  return usp.getAll(key);
}

// Build a query string from {key: value|array|null|undefined}, dropping
// null/undefined/empty-array entries (mirrors Route#cleanup_query's general
// shape, without every page-specific default-omission rule).
export function buildQuery(fields) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) usp.append(key, v);
    } else {
      usp.set(key, value);
    }
  }
  return usp.toString();
}

// Replace the current URL's query string without reloading the page.
export function replaceQuery(fields) {
  const qs = buildQuery(fields);
  const url = qs ? `${location.pathname}?${qs}${location.hash}` : location.pathname + location.hash;
  history.replaceState(null, "", url);
}

export function href(path, fields) {
  const qs = buildQuery(fields);
  return qs ? `${path}?${qs}` : path;
}
