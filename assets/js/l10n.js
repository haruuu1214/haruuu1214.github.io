// Port of lib/battle-cats-rolls/l10n.rb: flat string->string dictionary
// lookup per language, falling back to the original (English) text.

const cache = new Map();

async function loadDict(lang) {
  if (cache.has(lang)) return cache.get(lang);

  let dict = {};
  if (lang === "tw" || lang === "jp" || lang === "en") {
    try {
      const res = await fetch(`data/l10n-${lang}.json`);
      if (res.ok) dict = await res.json();
    } catch {
      dict = {};
    }
  }
  cache.set(lang, dict);
  return dict;
}

export async function preloadL10n(langs) {
  await Promise.all(langs.map(loadDict));
}

export function translate(lang, text) {
  const dict = cache.get(lang) || {};
  return Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : text;
}

export function proofreader(lang) {
  const dict = cache.get(lang) || {};
  return Object.prototype.hasOwnProperty.call(dict, "") ? dict[""] : "-";
}
