// Port of lib/battle-cats-rolls/gacha_pool.rb.

import { Cat, Rare, Supa, Uber, Legend, futureUberInfo } from "./cat.js";

export const BASE = 10000;

export class GachaPool {
  constructor(ball, { eventData = null, eventName = null } = {}) {
    this.event = eventData ?? (eventName != null ? ball.events[eventName] : null);

    if (this.event) {
      this.cats = ball.cats;
      this.gacha = ball.gacha[this.event.id]?.cats ?? null;
    } else {
      this.cats = null;
      this.gacha = null;
    }
  }

  digCat(id) {
    return this.cats?.[id];
  }

  digSlot(rarity) {
    return this.slots[rarity];
  }

  get rare() {
    return this.event.rare;
  }
  get supa() {
    return this.event.supa;
  }
  get uber() {
    return this.event.uber;
  }
  get legend() {
    if (this._legend === undefined) {
      this._legend = BASE - this.rare - this.supa - this.uber;
    }
    return this._legend;
  }

  get exist() {
    return !!this.gacha && Object.values(this.slots).some((s) => s.length > 0);
  }

  get version() {
    const num = parseInt(this.event.version, 10) || 0;
    const value = Math.floor(num / 10000) + (num % 1000) / 1000;
    return String(Number(value.toPrecision(6)));
  }

  get slots() {
    if (this._slots) return this._slots;

    const defaultSlots = () => ({ [Rare]: [], [Supa]: [], [Uber]: [], [Legend]: [] });

    if (!this.gacha) {
      this._slots = defaultSlots();
      return this._slots;
    }

    const result = defaultSlots();
    for (const catId of this.gacha) {
      const rarity = this.digCat(catId)?.rarity;
      if (rarity != null) {
        result[rarity].push(catId);
      } else {
        // A cat ID in the pool can't be found — treat the whole pool as
        // having no slots (data-integrity guard, gacha_pool.rb:42-49).
        this._slots = defaultSlots();
        return this._slots;
      }
    }
    this._slots = result;
    return this._slots;
  }

  get guaranteedRolls() {
    if (this._guaranteedRolls === undefined) {
      if (this.event.guaranteed) this._guaranteedRolls = 11;
      else if (this.event.step_up) this._guaranteedRolls = 15;
      else this._guaranteedRolls = 0;
    }
    return this._guaranteedRolls;
  }

  addFutureUbers(amount) {
    if (amount <= 0) return;

    // Avoid modifying the shared ball data.
    this.cats = { ...this.cats };

    for (let n = -1; n >= -amount; n--) {
      this.slots[Uber].unshift(n);
      this.cats[n] = futureUberInfo(n);
    }
  }
}
