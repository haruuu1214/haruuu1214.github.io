// Port of lib/battle-cats-rolls/stat.rb.
//
// Talent-driven numeric augmentation (health/damage/speed/cost/cooldowns)
// has no `prepend`/`super()` equivalent in JS, so it's implemented as an
// ordered-transform pipeline: `addAugmenter(key, fn)` appends a transform,
// and the getter for that attribute applies all registered transforms in
// the order they were added.
//
// Proof this reproduces Ruby's nested-`super` semantics: if talent1 augments
// before talent2, Ruby's `prepend` chain evaluates
// `talent2.transform(talent1.transform(base))` (last-prepended runs first,
// delegating inward via `super()`). Applying transforms via
// `[fn1, fn2].reduce((acc, fn) => fn(acc), base)` in *push* order computes
// `fn2(fn1(base))` — the same nesting — as long as talents are pushed in
// the same order they're processed (which `augment()` guarantees).

import * as AbilityModule from "./ability.js";
import {
  Attack,
  WaveAttack,
  SurgeAttack,
  ExplosionAttack,
} from "./attack.js";
import { Cat } from "./cat.js";
import { buildTalentAgainst } from "./talent.js";

export const DEFAULT_LEVEL = 30;
export const FPS = 30;

const TREASURE_MULTIPLIER = 2.5;
const CHAPTER2_COST_MULTIPLIER = 1.5;
const TIME_MULTIPLIER = 2;
const MINIMAL_COOLDOWN = 60;
const REDUCTION_FROM_BLUE_ORBS_AND_TREASURES = 264;

export class Stat {
  constructor({ id, info, index, level, conjureInfo, cat, sumNoWave, dpsNoCritical }) {
    this.id = id;
    this.info = info;
    this.index = index;
    this._level = level;
    this.conjureInfo = conjureInfo;
    this._cat = cat;
    this.sumNoWave = sumNoWave;
    this.dpsNoCritical = dpsNoCritical;

    this._augmenters = {
      healthRaw: [],
      damageRaw: [],
      speed: [],
      productionCost: [],
      productionCooldown: [],
      attackCooldown: [],
    };
    this.augmentingTalents = {};
  }

  addAugmenter(key, fn) {
    this._augmenters[key].push(fn);
  }

  augmentAttribute(talent, attribute) {
    (this.augmentingTalents[attribute] ??= []).push(talent);
  }

  get name() {
    return this.info.name?.[this.index] ?? this.cat.pickName(this.index);
  }

  get desc() {
    return this.info.desc?.[this.index] ?? this.cat.pickDescription(this.index);
  }

  get cat() {
    if (!this._cat) this._cat = new Cat({ id: this.id, info: this.info });
    return this._cat;
  }

  get statData() {
    if (this._statData) return this._statData;
    const base = this.info.stat[this.index];
    this._statData = this.conjureInfo
      ? { ...base, conjure_info: this.conjureInfo }
      : base;
    return this._statData;
  }

  get talentEligible() {
    return this.index === 2 || this.index === 3;
  }

  // Port of Stat#augment.
  augment(talents) {
    if (talents && this.talentEligible) {
      for (const talent of talents) talent.augment(this);

      if (this.info.talent_against) {
        buildTalentAgainst(this.info.talent_against).augment(this);
      }
    }

    this._finalize();
    return this;
  }

  get level() {
    return this._level ?? DEFAULT_LEVEL;
  }

  get effectiveLevel() {
    if (this._effectiveLevel === undefined) {
      this._effectiveLevel = Math.min(this.level, this.info.max_level);
    }
    return this._effectiveLevel;
  }

  get health() {
    if (this._health === undefined) this._health = Math.round(this.healthRaw);
    return this._health;
  }

  get healthRaw() {
    const base = this.statData.health * TREASURE_MULTIPLIER * this.levelMultiplier;
    return this._augmenters.healthRaw.reduce((v, fn) => fn(v), base);
  }

  get knockbacks() {
    return this.statData.knockbacks;
  }

  get speed() {
    const base = this.statData.speed;
    return this._augmenters.speed.reduce((v, fn) => fn(v), base);
  }

  get productionCost() {
    if (this._productionCost !== undefined) return this._productionCost;
    const base =
      this.statData.cost != null
        ? Math.floor(this.statData.cost * CHAPTER2_COST_MULTIPLIER)
        : "-";
    this._productionCost = this._augmenters.productionCost.reduce((v, fn) => fn(v), base);
    return this._productionCost;
  }

  get productionCooldown() {
    if (this._productionCooldown !== undefined) return this._productionCooldown;
    const base =
      this.statData.production_cooldown != null
        ? Math.max(
            MINIMAL_COOLDOWN,
            this.statData.production_cooldown * TIME_MULTIPLIER -
              REDUCTION_FROM_BLUE_ORBS_AND_TREASURES
          )
        : "-";
    this._productionCooldown = this._augmenters.productionCooldown.reduce(
      (v, fn) => fn(v),
      base
    );
    return this._productionCooldown;
  }

  get pushDuration() {
    if (this._pushDuration === undefined) {
      this._pushDuration = this.attackDuration != null ? this.attackCycle - this.attackDuration : null;
    }
    return this._pushDuration;
  }

  get attackCycle() {
    if (this._attackCycle === undefined) {
      this._attackCycle =
        this.attackDuration != null
          ? Math.max(
              this.attackDuration + 1,
              this.attacksRaw.reduce((sum, a) => sum + a.duration, 0) + this.attackCooldown - 1
            )
          : null;
    }
    return this._attackCycle;
  }

  get attackDuration() {
    return this.statData.attack_duration ?? null;
  }

  get attackCooldown() {
    if (this._attackCooldown !== undefined) return this._attackCooldown;
    const base = Math.trunc(this.statData.attack_cooldown ?? 0) * TIME_MULTIPLIER;
    this._attackCooldown = this._augmenters.attackCooldown.reduce((v, fn) => fn(v), base);
    return this._attackCooldown;
  }

  get damageSum() {
    if (this._damageSum !== undefined) return this._damageSum;
    if (this.maxDpsArea === "None") {
      this._damageSum = "-";
    } else {
      const attacks = this.sumNoWave ? this.attacksRaw : this.attacksMajor;
      this._damageSum = attacks.reduce((sum, a) => sum + a.damage, 0);
    }
    return this._damageSum;
  }

  get range() {
    return this.statData.range;
  }

  get baseRange() {
    return this.statData.long_range_0 ?? this.range;
  }

  get blindSpot() {
    const min = Math.min(...this.attacks.map((a) => a.areaRange[0]));
    return -this.width < min ? min - 1 : "-";
  }

  get width() {
    return this.statData.width;
  }

  get areaType() {
    return this.statData.area_effect ? "Area" : "Single range";
  }

  get longRange() {
    if (this._longRange === undefined) {
      this._longRange = !!this.statData.long_range_0;
    }
    return this._longRange;
  }

  get kamikaze() {
    if (this._kamikaze === undefined) {
      this._kamikaze = this.genericAbilities.some((a) => a instanceof AbilityModule.Kamikaze);
    }
    return this._kamikaze;
  }

  get effects() {
    if (!this._effects) {
      this._effects = [...this.specializedAbilities, ...this.genericAbilities].filter(
        (a) => a.effects
      );
    }
    return this._effects;
  }

  get waveEffect() {
    if (this._waveEffect === undefined) {
      this._waveEffect = this.effects.find((e) => e instanceof AbilityModule.Wave) ?? null;
    }
    return this._waveEffect;
  }

  get surgeEffect() {
    if (this._surgeEffect === undefined) {
      this._surgeEffect = this.effects.find((e) => e instanceof AbilityModule.Surge) ?? null;
    }
    return this._surgeEffect;
  }

  get explosionEffect() {
    if (this._explosionEffect === undefined) {
      this._explosionEffect =
        this.effects.find((e) => e instanceof AbilityModule.Explosion) ?? null;
    }
    return this._explosionEffect;
  }

  get dpsSum() {
    if (this._dpsSum !== undefined) return this._dpsSum;
    if (this.kamikaze || this.maxDpsArea === "None") {
      this._dpsSum = "-";
    } else if (this.attackCycle) {
      const attacks = this.sumNoWave ? this.attacksRaw : this.attacksMajor;
      this._dpsSum = attacks.reduce((sum, a) => sum + a.dps, 0);
    } else {
      this._dpsSum = undefined;
    }
    return this._dpsSum;
  }

  get maxDpsArea() {
    if (this._maxDpsArea !== undefined) return this._maxDpsArea;

    if (this.longRange) {
      const ranges = this.attacksMajor.map((a) => a.areaRange);
      const intersected = ranges.reduce((result, range) =>
        result ? [Math.max(result[0], range[0]), Math.min(result[1], range[1])] : range
      , null);

      this._maxDpsArea =
        intersected && intersected.length && intersected[0] <= intersected[1]
          ? `${intersected[0]} ~ ${intersected[1]}`
          : "None";
    } else if (this.statData.area_effect) {
      this._maxDpsArea = String(this.range);
    } else {
      this._maxDpsArea = "Single";
    }
    return this._maxDpsArea;
  }

  get attacks() {
    if (this._attacks) return this._attacks;

    if (this.waveEffect || this.surgeEffect || this.explosionEffect) {
      this._attacks = this.attacksRaw.flatMap((atk) => {
        if (atk.effects.length > 0) {
          const attackArgs = {
            stat: this,
            damage: atk.damage,
            triggerEffects: atk.triggerEffects,
          };

          const extra = [];
          if (this.waveEffect) extra.push(new WaveAttack(attackArgs));
          if (this.surgeEffect) {
            for (let i = 0; i < this.surgeEffect.level; i++) {
              extra.push(new SurgeAttack(attackArgs));
            }
          }
          if (this.explosionEffect) {
            extra.push(...new ExplosionAttack(attackArgs).toAttacks());
          }

          return [atk, ...extra];
        }
        return [atk];
      });
    } else {
      this._attacks = this.attacksRaw;
    }
    return this._attacks;
  }

  get attacksMajor() {
    if (!this._attacksMajor) {
      this._attacksMajor = this.attacks.filter((a) => !a.cascade);
    }
    return this._attacksMajor;
  }

  get attacksRaw() {
    if (this._attacksRaw) return this._attacksRaw;

    const attacks = [];
    for (let n = 0; n < 3; n++) {
      const value = this.damage(n);
      if (value == null) continue;
      attacks.push(
        new Attack({
          stat: this,
          damage: value,
          longRange: this._longRangeStat(n),
          longRangeOffset: this._longRangeOffsetStat(n),
          triggerEffects: this._triggerEffectsStat(n),
          duration: this._durationStat(n),
        })
      );
    }
    this._attacksRaw = attacks;
    return this._attacksRaw;
  }

  get singleDamage() {
    return this.statData.damage_1 == null;
  }

  get abilities() {
    if (!this._abilities) {
      this._abilities = AbilityModule.build(this.statData);
    }
    return this._abilities;
  }

  get specializedAbilities() {
    return this._specializedAbilities ?? [];
  }

  get genericAbilities() {
    return this._genericAbilities ?? [];
  }

  damage(n = 0) {
    const raw = this.damageRaw(n);
    return raw != null ? Math.round(raw) : null;
  }

  damageRaw(n = 0) {
    const value = this.statData[`damage_${n}`];
    const base = value != null ? value * TREASURE_MULTIPLIER * this.levelMultiplier : null;
    return this._augmenters.damageRaw.reduce((v, fn) => fn(v, n), base);
  }

  _longRangeStat(n = 0) {
    return this._attackStat("long_range", n);
  }

  _longRangeOffsetStat(n = 0) {
    return this._attackStat("long_range_offset", n);
  }

  _triggerEffectsStat(n = 0) {
    return this.statData[`trigger_effects_${n}`];
  }

  _durationStat(n = 0) {
    const prefix = "attack_time_";
    if (n === 0) return this.statData[`${prefix}${n}`];
    return this.statData[`${prefix}${n}`] - this.statData[`${prefix}${n - 1}`];
  }

  _attackStat(name, n = 0) {
    const key = `${name}_${n}`;
    if (n <= 0) return this.statData[key];
    return this.statData[key] ?? this._attackStat(name, n - 1);
  }

  get levelMultiplier() {
    if (this._levelMultiplier === undefined) {
      const growth = this.info.growth.map((percent) => percent / 100);
      const level = this.effectiveLevel;
      const reminder = level % 10;
      const steps = Math.floor(level / 10);

      this._levelMultiplier =
        1 +
        growth.slice(0, steps).reduce((a, b) => a + b, 0) * 10 +
        (growth[steps] ?? 0) * reminder -
        growth[0];
    }
    return this._levelMultiplier;
  }

  _finalize() {
    const sorted = [...this.abilities].sort((a, b) => a.index - b.index);
    this._specializedAbilities = sorted.filter((a) => a.specialized);
    this._genericAbilities = sorted.filter((a) => !a.specialized);
    return this;
  }
}
