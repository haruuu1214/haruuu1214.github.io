// Port of lib/battle-cats-rolls/gacha.rb — the core gacha rolling engine.
// See rng.js for the xorshift32 seed advance/retreat this builds on.

import { advanceSeed, retreatSeed, rubyToI } from "./rng.js";
import { Cat, Rare, Supa, Uber, Legend, catNone } from "./cat.js";
import { BASE } from "./gachaPool.js";

// Ruby's Array#dig/#[] treats a negative index as counting from the end;
// JS's plain indexing does not. `pos`/`pick` query params are user-supplied
// and can parse to a negative index via rubyToI's lenient "0 on garbage"
// behavior, so replicate Ruby's indexing exactly rather than JS's.
function rubyArrayAt(arr, i) {
  if (arr == null || i == null) return undefined;
  const idx = i < 0 ? arr.length + i : i;
  return idx >= 0 && idx < arr.length ? arr[idx] : undefined;
}

function rubyDig(cats, index, track) {
  const row = rubyArrayAt(cats, index);
  return row ? rubyArrayAt(row, track) : undefined;
}

export class Gacha {
  constructor(pool, seed) {
    this.pool = pool;
    this.seed = seed;
    this.lastBoth = [];
    this.lastRoll = null;
    this.position = null;

    this._advanceSeedSelf();
  }

  get rare() {
    return this.pool.rare;
  }
  get supa() {
    return this.pool.supa;
  }
  get uber() {
    return this.pool.uber;
  }
  get legend() {
    return this.pool.legend;
  }

  get rareCats() {
    return (this._rareCats ??= this._pickCats(Rare));
  }
  get supaCats() {
    return (this._supaCats ??= this._pickCats(Supa));
  }
  get uberCats() {
    return (this._uberCats ??= this._pickCats(Uber));
  }
  get legendCats() {
    return (this._legendCats ??= this._pickCats(Legend));
  }

  _pickCats(rarity) {
    return this.pool.digSlot(rarity).map(
      (id) => new Cat({ id, info: this.pool.digCat(id), rarity })
    );
  }

  // The heart of the algorithm: two parallel tracks (A/B) per roll. Each
  // track's rarity comes from one seed and its slot from the *next* seed —
  // see docs/assets/js notes in the port plan for the full seed trace.
  rollBoth(sequence = null) {
    const aSeed = this._rollSeed();
    const bSeed = this.seed;
    const aCat = this._rollCatAdvancing(aSeed);
    const bCat = this._rollCat(bSeed);
    aCat.track = 0;
    bCat.track = 1;
    aCat.sequence = bCat.sequence = sequence;

    this._fillCatLinks(aCat, this.lastBoth[0]);
    this._fillCatLinks(bCat, this.lastBoth[1]);

    this.lastBoth = [aCat, bCat];
    return [aCat, bCat];
  }

  // Existing dupes can cause more dupes ("bouncing" chains); and A/B tracks
  // can pass each other. Both are emergent from the algorithm below, not
  // special-cased (see gacha.rb's comments at the same call sites).
  finishRerolledLinks(cats) {
    this._eachCat(cats, (rolledCat, index, track) => {
      const rerolled = rolledCat.rerolled;
      if (!rerolled) return;

      const nextIndex = index + Gacha.nextIndex(track, rerolled.steps);
      const nextTrack = Gacha.nextTrack(track, rerolled.steps);
      const nextCat = rubyDig(cats, nextIndex, nextTrack);

      if (nextCat) this._fillCatLinks(nextCat, rerolled);
    });
  }

  static nextIndex(track, steps) {
    return Math.floor((track + steps) / 2) + 1;
  }

  static nextTrack(track, steps) {
    return ((track + steps - 1) ^ 1) & 1;
  }

  finishLastRoll(firstCat) {
    this._fillCatLinks(firstCat, this.lastRoll);
  }

  finishGuaranteed(cats, guaranteedRolls = this.pool.guaranteedRolls) {
    this._eachCat(cats, (rolledCat) => {
      this._fillGuaranteed(cats, guaranteedRolls, rolledCat);
      if (rolledCat.rerolled) {
        this._fillGuaranteed(cats, guaranteedRolls, rolledCat.rerolled);
      }
    });
  }

  finishPicking(cats, pick, guaranteedRolls = this.pool.guaranteedRolls) {
    const picked = this._digCatsFrom(cats, pick);
    if (!picked) return; // arbitrary user input guard
    if (pick.includes("G") && !picked.guaranteed) return;

    if (pick.includes("X")) {
      const prefix = new RegExp(`^${picked.number}`);
      if (pick.includes("G")) {
        this._fillPickingGuaranteed(cats, picked, prefix, guaranteedRolls);
      } else {
        this._fillPickingSingle(cats, picked, prefix);
      }
    } else if (pick.includes("G")) {
      this._fillPickingGuaranteed(cats, picked, `${picked.number}G`, guaranteedRolls);
    } else {
      this._fillPickingSingle(cats, picked, picked.number);
    }
  }

  markNextPosition(cats) {
    let nextPosition = this._digCatsFrom(cats, this.position);
    if (nextPosition) {
      if (
        this.lastRoll &&
        this.lastRoll.id === nextPosition.id &&
        nextPosition.rerolled // Only Rare can have a rerolled cat
      ) {
        nextPosition.rerolled.pickedLabel = "next_position";
      } else {
        nextPosition.pickedLabel = "next_position";
      }
    } else {
      nextPosition = this._digCatsFrom(cats, this.position.replace(/R$/, ""));
      if (nextPosition) nextPosition.pickedLabel = "next_position";
    }
  }

  backtrackSeed(baseSeed, steps) {
    let seed = baseSeed;
    for (let i = 0; i < steps; i++) seed = retreatSeed(seed);
    return seed;
  }

  dupedLastCat() {
    const slots = this.pool.digSlot(Rare);
    return slots[advanceSeed(this.seed) % slots.length];
  }

  // --- private ---

  _advanceSeedSelf() {
    this.seed = advanceSeed(this.seed);
  }

  _rollSeed() {
    const current = this.seed;
    this._advanceSeedSelf();
    return current;
  }

  _rollCat(raritySeed, slotSeedFn = null) {
    const score = raritySeed % BASE;
    const rarity = this._digRarity(score);
    const slotSeed = slotSeedFn ? slotSeedFn() : this.seed;
    const cat = this._newCat(rarity, slotSeed);

    cat.raritySeed = raritySeed;
    cat.score = score;
    return cat;
  }

  _rollCatAdvancing(raritySeed) {
    return this._rollCat(raritySeed, () => this._rollSeed());
  }

  _digRarity(score) {
    const rareSupa = this.rare + this.supa;
    if (score < this.rare) return Rare;
    if (score < rareSupa) return Supa;
    if (score < rareSupa + this.uber) return Uber;
    return Legend;
  }

  _newCat(rarity, slotSeed, extra = {}) {
    const slots = this.pool.digSlot(rarity);
    let slot, id, info;

    if (slots.length === 0) {
      slot = null;
      id = -1;
      info = catNone();
    } else {
      slot = slotSeed % slots.length;
      id = slots[slot];
      info = this.pool.digCat(id);
    }

    return new Cat({ id, info, rarity, slotSeed, slot, ...extra });
  }

  _rerollCat(cat) {
    const rarity = cat.rarity;
    const rerollingSlots = [...this.pool.digSlot(rarity)];
    let nextSeed = cat.slotSeed;
    let slot = cat.slot;
    let id = null;
    let steps = null;

    const dupeCount = rerollingSlots.filter((s) => s === cat.id).length;
    for (let attempt = 1; attempt <= dupeCount; attempt++) {
      nextSeed = advanceSeed(nextSeed);
      rerollingSlots.splice(slot, 1);
      slot = nextSeed % rerollingSlots.length;
      id = rerollingSlots[slot];

      if (id !== cat.id) {
        steps = attempt;
        break;
      }
    }

    return new Cat({
      id,
      info: this.pool.digCat(id),
      rarity,
      score: cat.score,
      slotSeed: nextSeed,
      slot,
      sequence: cat.sequence,
      track: cat.track,
      steps,
      extraLabel: `${cat.extraLabel ?? ""}R`,
    });
  }

  _fillCatLinks(cat, lastCat) {
    if (cat.duped(lastCat)) {
      // Guard against rerolling the same cat twice (it can dupe from both
      // A and B in the same roll_both! call).
      if (!cat.rerolled) cat.rerolled = this._rerollCat(cat);
      lastCat.next = cat.rerolled;
    } else if (lastCat) {
      lastCat.next = cat;
    }
  }

  _eachCat(cats, fn) {
    cats.forEach((row, index) => {
      row.forEach((rolledCat, track) => fn(rolledCat, index, track));
    });
  }

  _fillGuaranteed(cats, guaranteedRolls, rolledCat) {
    const last = this._followCat(rolledCat, guaranteedRolls - 1);
    if (!last) return;

    const nextIndex = last.sequence - (last.track ^ 1);
    const nextTrack = last.track ^ 1;
    const nextCat = rubyDig(cats, nextIndex, nextTrack);
    if (!nextCat) return;

    const guaranteedSlotSeed = rubyDig(cats, last.sequence - 1, last.track).raritySeed;

    rolledCat.guaranteed = this._newCat(Uber, guaranteedSlotSeed, {
      sequence: rolledCat.sequence,
      track: rolledCat.track,
      next: nextCat,
      extraLabel: `${rolledCat.extraLabel ?? ""}G`,
    });
  }

  _followCat(cat, steps) {
    let result = cat;
    for (let i = 0; i < steps; i++) {
      if (!result.next) return null;
      result = result.next;
    }
    return result;
  }

  _digCatsFrom(cats, marker) {
    const [index, track] = this._indexAndTrack(marker);
    const located = rubyDig(cats, index, track);
    if (!located) return null;
    return marker.includes("R") ? located.rerolled ?? null : located;
  }

  _indexAndTrack(marker) {
    const index = rubyToI(marker) - 1;
    const match = marker.match(/^\d+(\w)/);
    const letter = match ? match[1] : "A";
    const track = letter.charCodeAt(0) - "A".charCodeAt(0);
    return [index, track];
  }

  _fillPickingSingle(cats, picked, number) {
    const detected = this._fillPickingBacktrack(cats, number);
    const theCat = detected ?? picked;
    theCat.pickedLabel = "picked";
    if (theCat.next) theCat.next.pickedLabel = "next_position";
  }

  _fillPickingGuaranteed(cats, picked, number, guaranteedRolls) {
    const detected = this._fillPickingBacktrack(cats, number, "guaranteed");
    const theCat = detected ?? picked;
    const guaranteed = theCat.guaranteed;
    guaranteed.pickedLabel = "picked_consecutively";
    if (guaranteed.next) guaranteed.next.pickedLabel = "next_position";

    this._fillPickedConsecutivelyLabel(guaranteedRolls, theCat);
  }

  _fillPickingBacktrack(cats, number, whichCat = "itself") {
    const cat = this.lastRoll ?? this._digCatsFrom(cats, this.position) ?? cats[0]?.[0];
    if (!cat) return null;
    return this._fillPickingBacktrackFrom(cat, number, whichCat);
  }

  _fillPickingBacktrackFrom(cat, number, whichCat = "itself") {
    const path = [];
    let current = cat;

    while (true) {
      const checkingCat = whichCat === "itself" ? current : current.guaranteed;
      const matches = checkingCat
        ? number instanceof RegExp
          ? number.test(checkingCat.number)
          : number === checkingCat.number
        : false;

      if (matches) {
        for (const passed of path) passed.pickedLabel = "picked";
        return current;
      }

      path.push(current);
      if (!current.next) return null;
      current = current.next;
    }
  }

  _fillPickedConsecutivelyLabel(guaranteedRolls, cat) {
    const stepUp = guaranteedRolls === 15;
    let rolled = cat;

    for (let index = 0; index < guaranteedRolls - 1; index++) {
      rolled.pickedLabel =
        stepUp && index >= 3 && index < 8 ? "picked" : "picked_consecutively";

      if (!rolled.next) return;
      rolled = rolled.next;
    }
  }
}
