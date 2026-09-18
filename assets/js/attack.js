// Port of lib/battle-cats-rolls/attack.rb.

import { CriticalStrike, SavageBlow, Wave, Surge, Explosion } from "./ability.js";

export class Attack {
  constructor({ stat, damage, longRange, longRangeOffset, triggerEffects, duration, cascade }) {
    this.stat = stat;
    this._damage = damage;
    this.longRange = longRange;
    this.longRangeOffset = longRangeOffset;
    this.triggerEffects = triggerEffects;
    this.duration = duration;
    this.cascade = cascade;
  }

  get damage() {
    return this._damage;
  }

  displayShort() {
    return this.triggeredEffect.displayShort();
  }

  get areaType() {
    return this.stat.areaType;
  }

  get areaDisplay() {
    if (this._areaDisplay !== undefined) return this._areaDisplay;
    const [begin, end] = this.areaRange;
    this._areaDisplay = this.longRange != null ? `${begin} ~ ${end}` : String(end);
    return this._areaDisplay;
  }

  get areaRange() {
    if (this._areaRange) return this._areaRange;
    if (this.longRange != null) {
      const reach = this.longRange + this.longRangeOffset;
      this._areaRange = [this.longRange, reach].sort((a, b) => a - b);
    } else {
      this._areaRange = [-this.stat.width, this.stat.range];
    }
    return this._areaRange;
  }

  get effects() {
    if (this._effects) return this._effects;
    this._effects = this._triggerEffectsFlag() ? this.stat.effects : [];
    return this._effects;
  }

  get displayEffects() {
    if (this._displayEffects !== undefined) return this._displayEffects;
    this._displayEffects = this._triggerEffectsFlag()
      ? this.effects.map((e) => e.name)
      : "-";
    return this._displayEffects;
  }

  get dps() {
    if (this._dps !== undefined) return this._dps;
    if (this.stat.kamikaze) {
      this._dps = "-";
    } else if (this.stat.attackCycle) {
      const rawDps = (this.damage / this.stat.attackCycle) * 30; // Stat.FPS
      this._dps = this.stat.dpsNoCritical ? rawDps : this._accountCritical(rawDps);
    } else {
      this._dps = undefined;
    }
    return this._dps;
  }

  _triggerEffectsFlag() {
    // Older cats with a single attack might not be marked with triggering
    // effects, but they do trigger according to the game (e.g. Apple Cat,
    // id=40, has no trigger_effects flag but does trigger effects).
    return this.triggerEffects === 1 || this.stat.singleDamage;
  }

  get _criticalEffects() {
    return this.effects.filter(
      (e) => e instanceof CriticalStrike || e instanceof SavageBlow
    );
  }

  _accountCritical(rawDps) {
    return this._criticalEffects.reduce(
      (result, critical) =>
        result * (1 + (critical.modifier / 100) * (critical.chance / 100)),
      rawDps
    );
  }
}

export class TriggeredAttack extends Attack {
  get triggeredEffect() {
    throw new Error("not implemented");
  }

  get areaType() {
    return "Area"; // Wave, Surge, and Explosion are all area attacks
  }

  get damage() {
    if (this.triggeredEffect.mini) {
      return Math.round(this._damage * 0.2);
    }
    return this._damage;
  }

  get dps() {
    if (this.stat.kamikaze) {
      return super.dps;
    }
    if (this.stat.attackCycle) {
      return this._accountChance(super.dps);
    }
    return undefined;
  }

  get effects() {
    return super.effects.filter(
      (e) => !(e instanceof Wave || e instanceof Surge || e instanceof Explosion)
    );
  }

  _accountChance(rawDps) {
    if (typeof rawDps !== "number") return rawDps;
    return (rawDps * this.triggeredEffect.chance) / 100;
  }
}

export class WaveAttack extends TriggeredAttack {
  get triggeredEffect() {
    return this.stat.waveEffect;
  }

  get areaDisplay() {
    if (this._areaDisplay !== undefined) return this._areaDisplay;
    this._areaDisplay = String(this.areaRange[1]);
    return this._areaDisplay;
  }

  get areaRange() {
    if (this._areaRange) return this._areaRange;
    const width = 400;
    const begin = -67;
    const waveStep = Math.round(width * 0.5);
    this._areaRange = [begin, begin + width + waveStep * (this.triggeredEffect.level - 1)];
    return this._areaRange;
  }
}

export class SurgeAttack extends TriggeredAttack {
  get triggeredEffect() {
    return this.stat.surgeEffect;
  }

  get areaDisplay() {
    const [begin, end] = this.areaRange;
    return `${begin} ~ ${end}`;
  }

  get areaRange() {
    if (this._areaRange) return this._areaRange;
    const [begin, end] = this.triggeredEffect.areaRange;
    const backward = 250;
    const forward = 125;
    this._areaRange = [begin - backward, end + forward];
    return this._areaRange;
  }
}

export class ExplosionAttack extends TriggeredAttack {
  get triggeredEffect() {
    return this.stat.explosionEffect;
  }

  displayShort() {
    if (this.cascade) {
      return `Cascade of ${this.triggeredEffect.name.toLowerCase()}`;
    }
    return this.triggeredEffect.displayShort();
  }

  get areaDisplay() {
    if (this._areaDisplay !== undefined) return this._areaDisplay;
    const [, end] = this.areaRange;
    this._areaDisplay = this.cascade ? `~${end}` : `${this.areaRange[0]} ~ ${end}`;
    return this._areaDisplay;
  }

  get areaRange() {
    if (this._areaRange) return this._areaRange;
    const start = this.triggeredEffect.start;
    const pad = 75 + (this.cascade ?? 0) * 100;
    this._areaRange = [start - pad, start + pad];
    return this._areaRange;
  }

  // Ruby's `*explosion` splat implicitly calls #to_a, expanding one
  // ExplosionAttack into three (100%/70%/40% damage, cascade 0/1/2). JS has
  // no equivalent implicit coercion, so callers must call this explicitly.
  toAttacks() {
    return [
      this,
      new ExplosionAttack({
        stat: this.stat,
        damage: Math.floor(this._damage * 0.7),
        triggerEffects: this.triggerEffects,
        cascade: 1,
      }),
      new ExplosionAttack({
        stat: this.stat,
        damage: Math.floor(this._damage * 0.4),
        triggerEffects: this.triggerEffects,
        cascade: 2,
      }),
    ];
  }
}
