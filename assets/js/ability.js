// Port of lib/battle-cats-rolls/ability.rb: ~35 stateless "effect"
// descriptor classes, each built from the raw per-form stat hash when the
// relevant field(s) are present.
//
// Ruby sorts abilities by an `index` derived from `__LINE__` (source
// declaration order). Here that's replaced with an explicit numeric table
// preserving the same relative order (only relative order matters — it's
// only ever used for sort_by).

import {
  percent,
  percentHighlight,
  highlight,
  strong,
  seconds,
  secondsWithTreasure,
  qualifiedName,
  qualifiedValueName,
  RANGE_MULTIPLIER,
} from "./abilityUtility.js";

const INDEX = {
  Specialization: 1,
  AgainstOnly: 2,
  Strong: 3,
  MassiveDamage: 4,
  InsaneDamage: 5,
  Resistant: 6,
  InsaneResistant: 7,
  Knockback: 8,
  Freeze: 9,
  Slow: 10,
  Weaken: 11,
  Curse: 12,
  Dodge: 13,
  Survive: 14,
  Strengthen: 15,
  SavageBlow: 16,
  CriticalStrike: 17,
  MetalKiller: 18,
  BreakBarrier: 19,
  BreakShield: 20,
  ZombieKiller: 21,
  SoulStrike: 22,
  BaseDestroyer: 23,
  ColossusSlayer: 24,
  SageSlayer: 25,
  WitchSlayer: 26,
  EvaAngelSlayer: 27,
  BehemothSlayer: 28,
  Conjure: 29,
  Wave: 30,
  Surge: 31,
  CounterSurge: 32,
  Explosion: 33,
  ExtraMoney: 34,
  Metallic: 35,
  Kamikaze: 36,
  BlockWave: 37,
  Immunity: 38,
};

class AbilityBase {
  get specialized() {
    return false;
  }
  get effects() {
    return false;
  }
  get qualifiedName() {
    return qualifiedName(this.name);
  }
  get qualifiedValueName() {
    return qualifiedValueName(this.name);
  }
}

export class Specialization extends AbilityBase {
  static List = [
    "red", "float", "black", "angel", "alien", "zombie",
    "aku", "relic", "white", "metal",
  ];

  constructor(list) {
    super();
    this.list = list;
  }

  static display(list) {
    return Specialization.List.filter((t) => list.includes(t)).map(capitalize);
  }

  static buildIfAvailable(stat) {
    const list = Specialization.List.filter((type) => stat[`against_${type}`]);
    return list.length ? new Specialization(list) : null;
  }

  get name() {
    return "Specialized to";
  }
  display() {
    return Specialization.display(this.list);
  }
  get specialized() {
    return true;
  }
  get index() {
    return INDEX.Specialization;
  }
}

export class AgainstOnly extends AbilityBase {
  static buildIfAvailable(stat) {
    return stat.against_only ? new AgainstOnly() : null;
  }
  get name() {
    return "Attack only";
  }
  display() {
    return "Only attack specialized enemies or enemy base.<br>\nWhen cursed, only attack the base.";
  }
  get specialized() {
    return true;
  }
  get index() {
    return INDEX.AgainstOnly;
  }
}

function simpleFlag(className, { field, name, text, specialized, index }) {
  const cls = class extends AbilityBase {
    static buildIfAvailable(stat) {
      return stat[field] ? new cls() : null;
    }
    get name() {
      return name;
    }
    display() {
      return text;
    }
    get specialized() {
      return specialized;
    }
    get index() {
      return index;
    }
  };
  Object.defineProperty(cls, "name", { value: className });
  return cls;
}

export const Strong = simpleFlag("Strong", {
  field: "strong", name: "Strong",
  text: "Deal 150% or 180% damage and take 50% or 40% damage",
  specialized: true, index: INDEX.Strong,
});
export const MassiveDamage = simpleFlag("MassiveDamage", {
  field: "massive_damage", name: "Massive damage",
  text: "Deal 300% or 400% damage",
  specialized: true, index: INDEX.MassiveDamage,
});
export const InsaneDamage = simpleFlag("InsaneDamage", {
  field: "insane_damage", name: "Insane damage",
  text: "Deal 500% or 600% damage",
  specialized: true, index: INDEX.InsaneDamage,
});
export const Resistant = simpleFlag("Resistant", {
  field: "resistant", name: "Resistant",
  text: "Take 25% or 20% damage",
  specialized: true, index: INDEX.Resistant,
});
export const InsaneResistant = simpleFlag("InsaneResistant", {
  field: "insane_resistant", name: "Insane resistant",
  text: "Take 16% or 14% damage",
  specialized: true, index: INDEX.InsaneResistant,
});
export const ZombieKiller = simpleFlag("ZombieKiller", {
  field: "zombie_killer", name: "Zombie killer",
  text: "Final blow prevents zombies from reviving",
  specialized: false, index: INDEX.ZombieKiller,
});
export const SoulStrike = simpleFlag("SoulStrike", {
  field: "soul_strike", name: "Soul strike",
  text: "It can attack zombie corpses",
  specialized: false, index: INDEX.SoulStrike,
});
export const BaseDestroyer = simpleFlag("BaseDestroyer", {
  field: "base_destroyer", name: "Base destroyer",
  text: "Deal 400% damage to enemy base",
  specialized: false, index: INDEX.BaseDestroyer,
});
export const ColossusSlayer = simpleFlag("ColossusSlayer", {
  field: "colossus_slayer", name: "Colossus slayer",
  text: "Deal 160% damage to and take 70% damage from colossus",
  specialized: false, index: INDEX.ColossusSlayer,
});
export const SageSlayer = simpleFlag("SageSlayer", {
  field: "sage_slayer", name: "Sage slayer",
  text: "Deal 120% damage, take 50% damage, trigger 100% effects for sages",
  specialized: false, index: INDEX.SageSlayer,
});
export const WitchSlayer = simpleFlag("WitchSlayer", {
  field: "witch_slayer", name: "Witch slayer",
  text: "Deal 500% damage to and take 10% damage from witches",
  specialized: false, index: INDEX.WitchSlayer,
});
export const EvaAngelSlayer = simpleFlag("EvaAngelSlayer", {
  field: "eva_angel_slayer", name: "Eva angel slayer",
  text: "Deal 500% damage to and take 20% damage from eva angels",
  specialized: false, index: INDEX.EvaAngelSlayer,
});
export const ExtraMoney = simpleFlag("ExtraMoney", {
  field: "extra_money", name: "Extra money",
  text: "Get double money from defeating enemies",
  specialized: false, index: INDEX.ExtraMoney,
});
export const Metallic = simpleFlag("Metallic", {
  field: "metallic", name: "Metallic",
  text: "Take only 1 damage except from critical strikes",
  specialized: false, index: INDEX.Metallic,
});
export const Kamikaze = simpleFlag("Kamikaze", {
  field: "kamikaze", name: "Kamikaze",
  text: "It dies from its own attack",
  specialized: false, index: INDEX.Kamikaze,
});
export const BlockWave = simpleFlag("BlockWave", {
  field: "block_wave", name: "Block wave",
  text: "Immune to and block wave from reaching further",
  specialized: false, index: INDEX.BlockWave,
});
export const CounterSurge = simpleFlag("CounterSurge", {
  field: "counter_surge", name: "Counter-surge",
  text: "Spawn the same surge with self damage and effects when hit by a surge",
  specialized: false, index: INDEX.CounterSurge,
});

export class Knockback extends AbilityBase {
  constructor(chance) {
    super();
    this.chance = chance;
  }
  static buildIfAvailable(stat) {
    return stat.knockback_chance ? new Knockback(stat.knockback_chance) : null;
  }
  get name() {
    return "Knockback";
  }
  display(ctx) {
    return percentHighlight(this.chance, ctx);
  }
  get specialized() {
    return true;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.Knockback;
  }
}

class EffectDuration extends AbilityBase {
  constructor(chance, duration) {
    super();
    this.chance = chance;
    this.duration = duration;
  }
  display(ctx) {
    const chance = percent(this.chance);
    const duration = secondsWithTreasure(this.duration, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    return `${chance} for ${duration}`;
  }
  get specialized() {
    return true;
  }
  get effects() {
    return true;
  }
}

export class Freeze extends EffectDuration {
  static buildIfAvailable(stat) {
    return stat.freeze_chance
      ? new Freeze(stat.freeze_chance, stat.freeze_duration)
      : null;
  }
  get name() {
    return "Freeze";
  }
  get index() {
    return INDEX.Freeze;
  }
}

export class Slow extends EffectDuration {
  static buildIfAvailable(stat) {
    return stat.slow_chance ? new Slow(stat.slow_chance, stat.slow_duration) : null;
  }
  get name() {
    return "Slow";
  }
  get index() {
    return INDEX.Slow;
  }
}

export class Curse extends EffectDuration {
  static buildIfAvailable(stat) {
    return stat.curse_chance ? new Curse(stat.curse_chance, stat.curse_duration) : null;
  }
  get name() {
    return "Curse";
  }
  display(ctx) {
    const chance = percent(this.chance);
    const duration = secondsWithTreasure(this.duration, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    return `${chance} to invalidate specialization for ${duration}`;
  }
  get index() {
    return INDEX.Curse;
  }
}

export class Weaken extends AbilityBase {
  constructor(chance, duration, multiplier) {
    super();
    this.chance = chance;
    this.duration = duration;
    this.multiplier = multiplier;
  }
  static buildIfAvailable(stat) {
    return stat.weaken_chance
      ? new Weaken(stat.weaken_chance, stat.weaken_duration, stat.weaken_multiplier)
      : null;
  }
  get name() {
    return "Weaken";
  }
  display(ctx) {
    const chance = percent(this.chance);
    const multiplier = percent(this.multiplier);
    const duration = secondsWithTreasure(this.duration, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    return `${chance} to reduce enemies damage to ${multiplier} for ${duration}`;
  }
  get specialized() {
    return true;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.Weaken;
  }
}

export class Dodge extends AbilityBase {
  constructor(chance, duration) {
    super();
    this.chance = chance;
    this.duration = duration;
  }
  static buildIfAvailable(stat) {
    return stat.dodge_chance ? new Dodge(stat.dodge_chance, stat.dodge_duration) : null;
  }
  get name() {
    return "Dodge";
  }
  display(ctx) {
    const chance = percent(this.chance);
    const duration = secondsWithTreasure(this.duration, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    return `${chance} to become invulnerable when hit for ${duration}`;
  }
  get specialized() {
    return true;
  }
  get index() {
    return INDEX.Dodge;
  }
}

export class Survive extends AbilityBase {
  constructor(chance) {
    super();
    this.chance = chance;
  }
  static buildIfAvailable(stat) {
    return stat.survive_chance ? new Survive(stat.survive_chance) : null;
  }
  get name() {
    return "Survive";
  }
  display(ctx) {
    const chance = percentHighlight(this.chance, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    return `${chance} to survive a lethal strike to be knocked back with 1 health`;
  }
  get index() {
    return INDEX.Survive;
  }
}

export class Strengthen extends AbilityBase {
  constructor(threshold, modifier) {
    super();
    this.threshold = threshold;
    this.modifier = modifier;
  }
  static buildIfAvailable(stat) {
    return stat.strengthen_threshold
      ? new Strengthen(stat.strengthen_threshold, stat.strengthen_modifier)
      : null;
  }
  get name() {
    return "Strengthen";
  }
  display(ctx) {
    const multiplier = percentHighlight(this.modifier + 100, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    const threshold = percent(this.threshold);
    return `Deal ${multiplier} damage when health reached ${threshold}`;
  }
  get index() {
    return INDEX.Strengthen;
  }
}

export class SavageBlow extends AbilityBase {
  constructor(chance, modifier) {
    super();
    this.chance = chance;
    this.modifier = modifier;
  }
  static buildIfAvailable(stat) {
    return stat.savage_blow_chance
      ? new SavageBlow(stat.savage_blow_chance, stat.savage_blow_modifier)
      : null;
  }
  get name() {
    return "Savage blow";
  }
  display(ctx) {
    const chance = percentHighlight(this.chance, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    const multiplier = percent(this.modifier + 100);
    return `${chance} to deal ${multiplier} damage`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.SavageBlow;
  }
}

export class CriticalStrike extends AbilityBase {
  constructor(chance) {
    super();
    this.chance = chance;
  }
  static buildIfAvailable(stat) {
    return stat.critical_chance ? new CriticalStrike(stat.critical_chance) : null;
  }
  get name() {
    return "Critical strike";
  }
  display(ctx) {
    const p = percentHighlight(this.chance, {
      ...ctx,
      qualifiedValueName: this.qualifiedValueName,
    });
    return `${p} to deal 200% damage and ignore metal effect`;
  }
  get modifier() {
    return 100;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.CriticalStrike;
  }
}

export class MetalKiller extends AbilityBase {
  constructor(percentage) {
    super();
    this.percentage = percentage;
  }
  static buildIfAvailable(stat) {
    return stat.metal_killer ? new MetalKiller(stat.metal_killer) : null;
  }
  get name() {
    return "Metal killer";
  }
  display() {
    return `Deal ${percent(this.percentage)} health to metal enemies`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.MetalKiller;
  }
}

export class BreakBarrier extends AbilityBase {
  constructor(chance) {
    super();
    this.chance = chance;
  }
  static buildIfAvailable(stat) {
    return stat.break_barrier_chance ? new BreakBarrier(stat.break_barrier_chance) : null;
  }
  get name() {
    return "Break barrier";
  }
  display(ctx) {
    const p = percentHighlight(this.chance, { ...ctx, qualifiedValueName: this.qualifiedValueName });
    return `${p} to break star alien barrier`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.BreakBarrier;
  }
}

export class BreakShield extends AbilityBase {
  constructor(chance) {
    super();
    this.chance = chance;
  }
  static buildIfAvailable(stat) {
    return stat.break_shield_chance ? new BreakShield(stat.break_shield_chance) : null;
  }
  get name() {
    return "Break shield";
  }
  display(ctx) {
    const p = percentHighlight(this.chance, { ...ctx, qualifiedValueName: this.qualifiedValueName });
    return `${p} to break aku shield`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.BreakShield;
  }
}

export class BehemothSlayer extends AbilityBase {
  constructor(chance, duration) {
    super();
    this.chance = chance;
    this.duration = duration;
  }
  static buildIfAvailable(stat) {
    return stat.behemoth_slayer
      ? new BehemothSlayer(stat.behemoth_dodge_chance, stat.behemoth_dodge_duration)
      : null;
  }
  get name() {
    return "Behemoth slayer";
  }
  display(ctx) {
    const chance = percent(this.chance);
    const duration = seconds(this.duration, ctx);
    return `Deal 250% and take 60% damage, and ${chance} to be immune for ${duration}`;
  }
  get index() {
    return INDEX.BehemothSlayer;
  }
}

export class Conjure extends AbilityBase {
  constructor(catId, catInfo) {
    super();
    this.catId = catId;
    this.catInfo = catInfo;
  }
  static buildIfAvailable(stat) {
    return stat.conjure ? new Conjure(stat.conjure, stat.conjure_info) : null;
  }
  get name() {
    return "Conjure";
  }
  display(ctx) {
    if (this.catInfo) {
      const href = ctx.view.uriToCat(this.catId);
      const desc = this.catInfo.desc?.[0] ?? "";
      return `<a href="${href}">${desc}</a>`;
    }
    return "Unknown spirit";
  }
  get index() {
    return INDEX.Conjure;
  }
}

export class Wave extends AbilityBase {
  constructor(chance, level, mini) {
    super();
    this.chance = chance;
    this.level = level;
    this.mini = mini;
  }
  static buildIfAvailable(stat) {
    if (!stat.wave_level) return null;
    return new Wave(
      stat.wave_chance ?? stat.wave_mini,
      stat.wave_level,
      !!stat.wave_mini
    );
  }
  get name() {
    return this.mini ? "Mini-wave" : "Wave";
  }
  display(ctx) {
    const chance = percent(this.chance);
    const level = strong(this.level);
    return `${chance} to produce level ${level} ${this.name.toLowerCase()} attack`;
  }
  displayShort() {
    return `${percent(this.chance)} ${this.name.toLowerCase()}`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.Wave;
  }
}

export class Surge extends AbilityBase {
  constructor(chance, level, range, rangeOffset, mini) {
    super();
    this.chance = chance;
    this.level = level;
    this.range = range;
    this.rangeOffset = rangeOffset;
    this.mini = mini;
  }
  static buildIfAvailable(stat) {
    if (!stat.surge_level) return null;
    return new Surge(
      stat.surge_chance ?? stat.surge_mini,
      stat.surge_level,
      stat.surge_range,
      stat.surge_range_offset,
      !!stat.surge_mini
    );
  }
  get name() {
    return this.mini ? "Mini-surge" : "Surge";
  }
  get start() {
    return Math.floor(this.range * RANGE_MULTIPLIER);
  }
  get reach() {
    return this.start + Math.floor(this.rangeOffset * RANGE_MULTIPLIER);
  }
  get areaRange() {
    return [this.start, this.reach];
  }
  display(ctx) {
    const chance = percent(this.chance);
    const level = highlight(String(this.level), { view: ctx.view });
    const areaText = `${this.areaRange[0]} ~ ${this.areaRange[1]}`;
    const area = highlight(ctx.view.statRange(areaText), { view: ctx.view });
    return `${chance} to produce level ${level} ${this.name.toLowerCase()} attack within ${area}`;
  }
  displayShort() {
    return `${percent(this.chance)} ${this.name.toLowerCase()}`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.Surge;
  }
}

export class Explosion extends AbilityBase {
  constructor(chance, range) {
    super();
    this.chance = chance;
    this.range = range;
  }
  static buildIfAvailable(stat) {
    return stat.explosion_chance
      ? new Explosion(stat.explosion_chance, stat.explosion_range)
      : null;
  }
  get name() {
    return "Explosion";
  }
  get start() {
    return Math.floor(this.range * RANGE_MULTIPLIER);
  }
  display(ctx) {
    const chance = percent(this.chance);
    const range = strong(ctx.view.statRange(this.start));
    return `${chance} to trigger ${this.name.toLowerCase()} attack at ${range}`;
  }
  displayShort() {
    return `${percent(this.chance)} ${this.name.toLowerCase()}`;
  }
  get effects() {
    return true;
  }
  get index() {
    return INDEX.Explosion;
  }
}

export class Immunity extends AbilityBase {
  static List = [
    "bosswave", "knockback", "warp", "freeze", "slow", "weaken", "curse",
    "wave", "surge", "explosion", "toxic",
  ];

  constructor(list) {
    super();
    this.list = list;
  }
  static buildIfAvailable(stat) {
    const list = Immunity.List.filter((effect) => stat[`immune_${effect}`]);
    return list.length ? new Immunity(list) : null;
  }
  get name() {
    return "Immune to";
  }
  display() {
    return Immunity.List.filter((e) => this.list.includes(e)).map(capitalize);
  }
  get index() {
    return INDEX.Immunity;
  }
}

// Only ever constructed via talents (Talent::EffectRate/Resistance) — there
// is no direct stat field for it.
export class Resistance extends AbilityBase {
  constructor(percentage, type, kind) {
    super();
    this.percentage = percentage;
    this.type = type;
    this.kind = kind;
  }
  static buildIfAvailable() {
    return null;
  }
  get name() {
    return "Resistance";
  }
  get qualifiedName() {
    return `${qualifiedName(this.name)}.${this.type}`;
  }
  display() {
    return `Reduce ${strong(this.type)} ${this.kind} by ${percent(this.percentage)}`;
  }
  get index() {
    const listIndex = Immunity.List.indexOf(this.type);
    return INDEX.Immunity + 1 + (listIndex + 1) * 0.01;
  }
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Declaration order matters only in that it matches ability.rb's file
// order, which is what the (now-explicit) INDEX table encodes.
const BUILDERS = [
  Specialization, AgainstOnly, Strong, MassiveDamage, InsaneDamage,
  Resistant, InsaneResistant, Knockback, Freeze, Slow, Weaken, Curse,
  Dodge, Survive, Strengthen, SavageBlow, CriticalStrike, MetalKiller,
  BreakBarrier, BreakShield, ZombieKiller, SoulStrike, BaseDestroyer,
  ColossusSlayer, SageSlayer, WitchSlayer, EvaAngelSlayer, BehemothSlayer,
  Conjure, Wave, Surge, CounterSurge, Explosion, ExtraMoney, Metallic,
  Kamikaze, BlockWave, Immunity,
];

export function build(stat) {
  return BUILDERS.map((cls) => cls.buildIfAvailable(stat)).filter(Boolean);
}
