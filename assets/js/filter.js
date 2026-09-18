// Port of lib/battle-cats-rolls/filter.rb: the /cats filter engine.

import { Stat, FPS } from "./stat.js";
import * as Talent from "./talent.js";

function toI(value) {
  if (typeof value === "number") return Math.trunc(value);
  return 0;
}

function toF(value) {
  if (typeof value === "number") return value;
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

const identity = (x) => x;

export class Chain {
  constructor(cats, { level, excludeTalents, sumNoWave, dpsNoCritical }) {
    this.cats = cats; // plain object: id -> info
    this.level = level;
    this.excludeTalents = excludeTalents;
    this.sumNoWave = sumNoWave;
    this.dpsNoCritical = dpsNoCritical;
    this._matchedStats = {};
    this._talents = {};
  }

  // selected: array of chosen filter-item strings for this control.
  // allOrAny: "all" | "any".
  // filterTable: map of item -> (string field name | null | function(item,id,info,index) | {match(abilities,stat)}).
  filter(selected, allOrAny, filterTable) {
    if (selected.length === 0) return;

    const kept = {};
    for (const [idStr, info] of Object.entries(this.cats)) {
      const id = Number(idStr);
      const previouslyMatched = this._matchedStats[id];

      const indices = info.stat.map((rawStat, index) => {
        if (previouslyMatched && !previouslyMatched[index]) return null;

        const abilities = this._expandStat(info, rawStat, index);
        const test = (item) => {
          const filter = filterTable[item];
          if (filter === undefined || filter === null || typeof filter === "string") {
            return !!(abilities[filter] || abilities[item]);
          }
          if (typeof filter === "function") {
            return !!filter(item, id, info, index);
          }
          const stat = new Stat({
            id,
            info,
            index,
            level: this.level,
            sumNoWave: this.sumNoWave,
            dpsNoCritical: this.dpsNoCritical,
          }).augment(this._talentsFor(id, info));
          return !!filter.match(abilities, stat);
        };

        const matches = allOrAny === "all" ? selected.every(test) : selected.some(test);
        return matches ? index : null;
      });

      this._matchedStats[id] = indices;
      if (indices.some((i) => i != null)) {
        kept[idStr] = info;
      }
    }
    this.cats = kept;
  }

  _expandStat(info, rawStat, index) {
    if (this.excludeTalents || index < 2) return rawStat;

    const against = {};
    for (const type of info.talent_against ?? []) {
      against[`against_${type}`] = true;
    }
    return { ...rawStat, ...(info.talent ?? {}), ...against };
  }

  _talentsFor(id, info) {
    if (this.excludeTalents) return null;
    if (!(id in this._talents)) {
      this._talents[id] = Talent.build(info);
    }
    return this._talents[id];
  }
}

export const LongRange = {
  match(abilities) {
    return !!abilities.long_range_0 && !OmniStrike.match(abilities);
  },
};

export const OmniStrike = {
  match(abilities) {
    return toI(abilities.long_range_offset_0) < 0;
  },
};

export const FrontStrike = {
  match(abilities) {
    return !abilities.long_range_0;
  },
};

export const Single = {
  match(abilities) {
    return !abilities.area_effect;
  },
};

export const HighDPS = {
  match(abilities, stat, { threshold = 7500, modifier = identity } = {}) {
    if (Math.round(modifier(toF(stat.dpsSum))) >= threshold) return true;
    return stat.attacksRaw.some((a) => Math.round(modifier(toF(a.dps))) >= threshold);
  },
};

export const VeryHighDPS = {
  match(abilities, stat, { modifier = identity } = {}) {
    return HighDPS.match(abilities, stat, { threshold: 15000, modifier });
  },
};

export const ExtremelyHighDPS = {
  match(abilities, stat, { modifier = identity } = {}) {
    return HighDPS.match(abilities, stat, { threshold: 25000, modifier });
  },
};

const SPECIALIZATION_WITH_TREASURES_KEYS = [
  "against_red", "against_float", "against_black",
  "against_angel", "against_alien", "against_zombie",
];
const SPECIALIZATION_WITHOUT_TREASURES_KEYS = [
  "against_aku", "against_relic", "against_white", "against_metal",
];

function detectModifier(abilities, withTreasures, withoutTreasures) {
  let factor;
  if (SPECIALIZATION_WITH_TREASURES_KEYS.some((k) => abilities[k])) {
    factor = withTreasures;
  } else if (SPECIALIZATION_WITHOUT_TREASURES_KEYS.some((k) => abilities[k])) {
    factor = withoutTreasures;
  } else {
    // Ruby crashes here (nil.method(:*)) — in practice every cat with
    // strong/massive_damage/insane_damage also has a specialization, so
    // this branch shouldn't occur on real data. Degrade gracefully instead
    // of throwing.
    factor = 1;
  }
  return (x) => x * factor;
}

export const HighEffectiveDPS = {
  match(abilities, stat, { filter = HighDPS } = {}) {
    let modifiers;
    if (abilities.strong) modifiers = [1.8, 1.5];
    else if (abilities.massive_damage) modifiers = [4, 3];
    else if (abilities.insane_damage) modifiers = [6, 5];
    return HighEffectiveDPS.filterMatch(abilities, stat, modifiers, filter);
  },
  filterMatch(abilities, stat, modifiers, filter) {
    if (modifiers) {
      return filter.match(abilities, stat, {
        modifier: detectModifier(abilities, ...modifiers),
      });
    }
    return filter.match(abilities, stat);
  },
};

export const VeryHighEffectiveDPS = {
  match(abilities, stat) {
    return HighEffectiveDPS.match(abilities, stat, { filter: VeryHighDPS });
  },
};

export const ExtremelyHighEffectiveDPS = {
  match(abilities, stat) {
    return HighEffectiveDPS.match(abilities, stat, { filter: ExtremelyHighDPS });
  },
};

export const HighSingleBlow = {
  match(abilities, stat, { threshold = 50000, modifier = identity } = {}) {
    return stat.attacksRaw.some((a) => modifier(toI(a.damage)) >= threshold);
  },
};

export const VeryHighSingleBlow = {
  match(abilities, stat, { modifier = identity } = {}) {
    return HighSingleBlow.match(abilities, stat, { threshold: 100000, modifier });
  },
};

export const ExtremelyHighSingleBlow = {
  match(abilities, stat, { modifier = identity } = {}) {
    return HighSingleBlow.match(abilities, stat, { threshold: 200000, modifier });
  },
};

export const HighEffectiveSingleBlow = {
  match(abilities, stat) {
    return HighEffectiveDPS.match(abilities, stat, { filter: HighSingleBlow });
  },
};

export const VeryHighEffectiveSingleBlow = {
  match(abilities, stat) {
    return HighEffectiveDPS.match(abilities, stat, { filter: VeryHighSingleBlow });
  },
};

export const ExtremelyHighEffectiveSingleBlow = {
  match(abilities, stat) {
    return HighEffectiveDPS.match(abilities, stat, { filter: ExtremelyHighSingleBlow });
  },
};

export const HighHealth = {
  match(abilities, stat, { threshold = 100000, modifier = identity } = {}) {
    return modifier(stat.health) >= threshold;
  },
};

export const VeryHighHealth = {
  match(abilities, stat, { modifier = identity } = {}) {
    return HighHealth.match(abilities, stat, { threshold: 200000, modifier });
  },
};

export const ExtremelyHighHealth = {
  match(abilities, stat, { modifier = identity } = {}) {
    return HighHealth.match(abilities, stat, { threshold: 400000, modifier });
  },
};

export const HighEffectiveHealth = {
  match(abilities, stat, { filter = HighHealth } = {}) {
    let modifiers;
    if (abilities.strong) modifiers = [2.5, 2];
    else if (abilities.resistant) modifiers = [5, 4];
    else if (abilities.insane_resistant) modifiers = [7, 6];
    return HighEffectiveDPS.filterMatch(abilities, stat, modifiers, filter);
  },
};

export const VeryHighEffectiveHealth = {
  match(abilities, stat) {
    return HighEffectiveHealth.match(abilities, stat, { filter: VeryHighHealth });
  },
};

export const ExtremelyHighEffectiveHealth = {
  match(abilities, stat) {
    return HighEffectiveHealth.match(abilities, stat, { filter: ExtremelyHighHealth });
  },
};

export const KnockbacksOne = {
  display: () => "=1",
  match: (abilities) => abilities.knockbacks <= 1,
};
export const KnockbacksTwo = {
  display: () => "<=2",
  match: (abilities) => abilities.knockbacks <= 2,
};
export const KnockbacksFive = {
  display: () => "3~5",
  match: (abilities) => abilities.knockbacks >= 3 && abilities.knockbacks <= 5,
};
export const KnockbacksSix = {
  display: () => ">=6",
  match: (abilities) => abilities.knockbacks >= 6,
};

export const Melee = {
  display: (view) => view.statRange("<250"),
  match: (abilities) => toI(abilities.range) < 250,
};
export const Midrange = {
  display: (view) => view.statRange("250~449"),
  match: (abilities) => {
    const range = toI(abilities.range);
    return range >= 250 && range < 450;
  },
};
export const Backline = {
  display: (view) => view.statRange(">=450"),
  match: (abilities) => toI(abilities.range) >= 450,
};
export const Rearline = {
  display: (view) => view.statRange(">=550"),
  match: (abilities) => toI(abilities.range) >= 550,
};

export function ReachFilter(criteria) {
  return {
    display: (view) => `>=${view.statRange(criteria)}`,
    match: (abilities, stat) => stat.attacks.some((a) => a.areaRange[1] >= criteria),
  };
}

export function SpeedFilter(criteria, op) {
  const cmp = op === "<=" ? (v) => v <= criteria : (v) => v >= criteria;
  return {
    display: (view) => `${op}${view.statSpeed(criteria)}`,
    match: (abilities) => cmp(toI(abilities.speed)),
  };
}

export function CostFilter(criteria) {
  return {
    display: () => `<=${criteria}`,
    match: (abilities, stat) =>
      typeof stat.productionCost === "number" ? stat.productionCost <= criteria : false,
  };
}

export function ProductionFilter(criteria) {
  return {
    display: () => `<=${Math.round((criteria / FPS) * 100) / 100}s`,
    match: (abilities, stat) =>
      typeof stat.productionCooldown === "number"
        ? stat.productionCooldown <= criteria
        : false,
  };
}

export const Backswing = {
  match(abilities, stat) {
    return toI(stat.pushDuration) <= 1;
  },
};

export const SpecializationWithTreasures = {
  red: "against_red",
  float: "against_float",
  black: "against_black",
  angel: "against_angel",
  alien: "against_alien",
  zombie: "against_zombie",
};

export const SpecializationWithoutTreasures = {
  aku: "against_aku",
  relic: "against_relic",
  white: "against_white",
  metal: "against_metal",
};

export const Specialization = {
  ...SpecializationWithTreasures,
  ...SpecializationWithoutTreasures,
};

export const Buff = {
  massive_damage: null,
  insane_damage: null,
  strong: null,
};

export const Resistant = {
  resistant: null,
  insane_resistant: null,
};

export const RangeFilters = {
  "long-range": LongRange,
  "omni-strike": OmniStrike,
  "front-strike": FrontStrike,
};

export const Area = {
  area: "area_effect",
  single: Single,
};

export const Control = {
  freeze: "freeze_chance",
  slow: "slow_chance",
  knockback: "knockback_chance",
  weaken: "weaken_chance",
  curse: "curse_chance",
};

export const Immunity = {
  freeze: "immune_freeze",
  slow: "immune_slow",
  knockback: "immune_knockback",
  warp: "immune_warp",
  weaken: "immune_weaken",
  curse: "immune_curse",
  wave: "immune_wave",
  block_wave: null,
  surge: "immune_surge",
  explosion: "immune_explosion",
  toxic: "immune_toxic",
  bosswave: "immune_bosswave",
};

export const Counter = {
  critical_strike: "critical_chance",
  metal_killer: null,
  break_barrier: "break_barrier_chance",
  break_shield: "break_shield_chance",
  zombie_killer: null,
  soul_strike: null,
  colossus_slayer: null,
  behemoth_slayer: null,
  sage_slayer: null,
  witch_slayer: null,
  eva_angel_slayer: null,
  base_destroyer: null,
};

export const Combat = {
  savage_blow: "savage_blow_chance",
  strengthen: "strengthen_threshold",
  wave: "wave_chance",
  "mini-wave": "wave_mini",
  surge: "surge_chance",
  "mini-surge": "surge_mini",
  "counter-surge": "counter_surge",
  explosion: "explosion_chance",
  conjure: null,
};

export const Other = {
  extra_money: null,
  dodge: "dodge_chance",
  survive: "survive_chance",
  attack_only: "against_only",
  metallic: null,
  kamikaze: null,
};

export const Rarities = ["normal", "special", "rare", "super", "uber", "legend"];
export const RarityFilter = (rarity, id, info) => info.rarity === Rarities.indexOf(rarity);
export const Rarity = Object.fromEntries(Rarities.map((r) => [r, RarityFilter]));

export const DPS = {
  high: HighDPS,
  high_effectively: HighEffectiveDPS,
  very_high: VeryHighDPS,
  very_high_effectively: VeryHighEffectiveDPS,
  extremely_high_effectively: ExtremelyHighEffectiveDPS,
};

export const Damage = {
  high: HighSingleBlow,
  high_effectively: HighEffectiveSingleBlow,
  very_high: VeryHighSingleBlow,
  very_high_effectively: VeryHighEffectiveSingleBlow,
  extremely_high_effectively: ExtremelyHighEffectiveSingleBlow,
};

export const Health = {
  high: HighHealth,
  high_effectively: HighEffectiveHealth,
  very_high: VeryHighHealth,
  very_high_effectively: VeryHighEffectiveHealth,
  extremely_high_effectively: ExtremelyHighEffectiveHealth,
};

export const Knockbacks = {
  1: KnockbacksOne,
  2: KnockbacksTwo,
  5: KnockbacksFive,
  6: KnockbacksSix,
};

export const Stand = {
  melee: Melee,
  midrange: Midrange,
  backline: Backline,
  rearline: Rearline,
};

export const Reach = {
  600: ReachFilter(600),
  800: ReachFilter(800),
  1000: ReachFilter(1000),
  1200: ReachFilter(1200),
};

export const Speed = {
  3: SpeedFilter(3, "<="),
  5: SpeedFilter(5, "<="),
  20: SpeedFilter(20, ">="),
  30: SpeedFilter(30, ">="),
  40: SpeedFilter(40, ">="),
};

export const Cost = {
  4500: CostFilter(4500),
  3500: CostFilter(3500),
  2500: CostFilter(2500),
  1500: CostFilter(1500),
  1000: CostFilter(1000),
  500: CostFilter(500),
  150: CostFilter(150),
  75: CostFilter(75),
};

export const Production = {
  350: ProductionFilter(350),
  175: ProductionFilter(175),
  60: ProductionFilter(60),
};

export const Aspect = {
  backswing: Backswing,
};
