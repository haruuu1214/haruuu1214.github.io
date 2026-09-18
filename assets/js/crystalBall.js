// Port of lib/battle-cats-rolls/crystal_ball.rb (runtime portions only —
// the build-time gacha-event-guessing/dumping methods stay in Ruby; this
// just consumes the already-built, already-normalized docs/data/bc-*.json).

import { Cat, Uber, Legend } from "./cat.js";

const EVENTS_PER_PAGE = 100;

// Verbatim copy of CrystalBall.predefined_rates (crystal_ball.rb:125-145).
// Small static table, not derived from YAML.
export const PREDEFINED_RATES = {
  predicted: { name: "Predicted" },
  regular: { name: "Regular", rate: [6970, 2500, 500] },
  no_legend: { name: "Regular without legend", rate: [7000, 2500, 500] },
  uberfest_legend: { name: "Uberfest / Epicfest", rate: [6470, 2600, 900] },
  uberfest: {
    name: "Uberfest / Epicfest without legend",
    rate: [6500, 2600, 900],
  },
  dynastyfest: { name: "Dynasty Fest", rate: [6770, 2500, 700] },
  royalfest: { name: "Royalfest", rate: [6940, 2500, 500] },
  superfest_legend: { name: "Superfest", rate: [6470, 2500, 1000] },
  superfest: { name: "Superfest without legend", rate: [6500, 2500, 1000] },
  platinum: { name: "Platinum", rate: [0, 0, 10000] },
  legend: { name: "Legend", rate: [0, 0, 9500] },
  "": { name: "Customize..." },
};

export function groupByRarity(cats) {
  const groups = {};
  for (const [id, data] of Object.entries(cats)) {
    const rarity = data.rarity;
    if (!groups[rarity]) groups[rarity] = {};
    groups[rarity][id] = data;
  }
  const sorted = {};
  for (const key of Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)) {
    sorted[key] = groups[key];
  }
  return sorted;
}

const cache = new Map();

export async function loadBall(lang) {
  if (cache.has(lang)) return cache.get(lang);

  const res = await fetch(`data/bc-${lang}.json`);
  const data = await res.json();
  const ball = new CrystalBall(data);
  cache.set(lang, ball);
  return ball;
}

export class CrystalBall {
  constructor(data) {
    this.data = data;
    this._catsByRarity = null;
    this._eventsArray = null;
  }

  get cats() {
    return this.data.cats;
  }

  get gacha() {
    return this.data.gacha;
  }

  get events() {
    return this.data.events;
  }

  get catsByRarity() {
    if (!this._catsByRarity) {
      this._catsByRarity = groupByRarity(this.cats);
    }
    return this._catsByRarity;
  }

  eventsPage(page) {
    if (!this._eventsArray) {
      this._eventsArray = Object.entries(this.events);
    }
    const arr = this._eventsArray;
    const size = arr.length;
    const offset = EVENTS_PER_PAGE * page;
    const start = size - Math.min(offset, size);
    const length = Math.max(
      0,
      Math.min(EVENTS_PER_PAGE, size - (offset - EVENTS_PER_PAGE))
    );
    return Object.fromEntries(arr.slice(start, start + length));
  }

  *eachCustomGacha(nameIndex) {
    const ubers = Object.keys(this.catsByRarity[Uber] ?? {}).map(Number);
    const legends = Object.keys(this.catsByRarity[Legend] ?? {}).map(Number);

    const entries = Object.entries(this.gacha).reverse();
    for (const [gachaId, gachaData] of entries) {
      let title;
      if (gachaData.similarity) {
        title = `(${gachaData.similarity}%) ${gachaData.name}`;
      } else {
        title =
          gachaData.name ??
          this.hintGachaName(nameIndex, gachaData.cats, ubers, legends);
      }
      yield [gachaId, `${gachaId}: ${title}`];
    }
  }

  hintGachaName(nameIndex, catIds, ubers, legends) {
    const prefixId =
      catIds.find((id) => legends.includes(id)) ??
      catIds.find((id) => ubers.includes(id));

    const suffixId = [...catIds].reverse().find((id) => ubers.includes(id));

    const prefixCat = prefixId != null ? this.cats[prefixId] : undefined;
    const suffixCat =
      suffixId != null && suffixId !== prefixId ? this.cats[suffixId] : undefined;

    const prefix = prefixCat
      ? new Cat({ info: prefixCat }).pickName(nameIndex)
      : undefined;
    const suffix = suffixCat
      ? new Cat({ info: suffixCat }).pickName(nameIndex)
      : undefined;

    const hint = [prefix, suffix].filter((x) => x != null).join(", ");

    return `(?) ${hint}`;
  }
}
