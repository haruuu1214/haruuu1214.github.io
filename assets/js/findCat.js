// Port of lib/battle-cats-rolls/find_cat.rb.
//
// Note: `ids` (search targets) is a plain array that can contain
// duplicates (every legend cat in the pool is unconditionally appended,
// even if already present from the exclusives/find target list) — ported
// literally, not deduplicated, to match Ruby's Array#- semantics exactly
// (including the resulting "found.size never reaches ids.size when there
// are duplicates" quirk this implies).

import { Cat } from "./cat.js";

export const MAX = 999;

export const EXCLUSIVES = [
  270, // Baby Gao
  284, // Pai-Pai
  287, // Strike Unit R.E.I.
  319, // Miko Mitama
  381, // D'artanyan
  334, // Shadow Gao
  379, // Dark Mitama
  398, // Sakura Sonic
  436, // Li'l Valkyrie
  442, // D'arktanyan
  485, // Li'l Valkyrie Dark
  521, // Good-Luck Ebisu
  530, // Kasli the Scourge
  544, // Kasli the Bane
  560, // Hell Warden Emma
  586, // Baby Garu
  610, // Shadow Garu
  613, // Princess Cat
  642, // Iz the Dancer
  658, // Iz the Dancer of Grief
  687, // Goddess of Light Sirius
  691, // Child of Destiny Phono
  706, // King of Doom Phono
  759, // Trixi the Merc
  780, // Celestial Child Luna
  784, // Koneko
  788, // Netherworld Nymph Lunacia
  811, // Agent Staal
  838, // Squire Luno
  860, // Lone Moon Lunos
];

export class FindCat {
  static search(gacha, find, args) {
    return new FindCat(gacha, [...EXCLUSIVES, find]).search(args);
  }

  constructor(gacha, targetIds) {
    this.gacha = gacha;

    const allPoolCats = [
      ...gacha.rareCats,
      ...gacha.supaCats,
      ...gacha.uberCats,
      ...gacha.legendCats,
    ];
    const idsInGacha = allPoolCats
      .filter((cat) => targetIds.includes(cat.id))
      .map((cat) => cat.id);

    idsInGacha.push(...gacha.legendCats.map((cat) => cat.id));

    this.ids = idsInGacha;
  }

  search({ cats = [], guaranteed = true, max = MAX } = {}) {
    if (this.ids.length === 0) return [];

    const found = this._searchDeep(cats, guaranteed, max);

    if (Object.keys(found).length < this.ids.length) {
      const foundIds = new Set(Object.keys(found).map(Number));
      const missing = this.ids.filter((id) => !foundIds.has(id));
      const extra = missing.map(
        (missingId) =>
          new Cat({ id: missingId, info: this.gacha.pool.digCat(missingId), sequence: max })
      );
      return [...Object.values(found), ...extra];
    }
    return Object.values(found);
  }

  _searchDeep(cats, guaranteed, max) {
    const found = this._searchFromCats(cats, guaranteed, this.ids);
    if (Object.keys(found).length < this.ids.length) {
      return this._searchFromRolling(found, cats, guaranteed, max);
    }
    return found;
  }

  _searchFromCats(cats, guaranteed, remainingIds) {
    let result = {};
    for (const ab of cats) {
      const stillNeeded = remainingIds.filter((id) => !(id in result));
      for (const id of stillNeeded) {
        for (const cat of ab) {
          if (id === cat.id) {
            result[id] = cat;
          } else if (cat.guaranteed && id === cat.guaranteed.id) {
            if (guaranteed) result[id] = cat.guaranteed;
          }
        }
      }
      if (Object.keys(result).length === remainingIds.length) break;
    }
    return result;
  }

  // Limitation ported as-is from find_cat.rb:116-121: rows are rolled one
  // at a time here, so guaranteed-uber cats are never populated during
  // this fallback (guaranteed detection needs the next guaranteedRolls-1
  // cats already rolled, which isn't available mid-stream).
  _searchFromRolling(found, cats, guaranteed, max) {
    const result = { ...found };
    for (let sequence = cats.length + 1; sequence <= max; sequence++) {
      if (Object.keys(result).length === this.ids.length) break;

      const newAb = this.gacha.rollBoth(sequence);
      const remaining = this.ids.filter((id) => !(id in result));
      Object.assign(result, this._searchFromCats([newAb], guaranteed, remaining));
    }
    return result;
  }
}
