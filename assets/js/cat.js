// Port of lib/battle-cats-rolls/cat.rb.
//
// A Cat instance serves two roles: (1) a mutable "rolled cell" node in the
// Gacha linked-list grid (rarity_seed/score/slot/slotSeed/sequence/track/
// steps/next/rerolled/guaranteed/pickedLabel/extraLabel), and (2) a thin
// wrapper around a cat's static `info` data (id/info/rarity).
//
// Note: `rarity` here is the gacha rarity constant (Rare/Supa/Uber/Legend)
// used while rolling; `info.rarity` is the cat's own 0-5 rarity field
// (Normal/Special/Rare/SuperRare/UberRare/LegendRare).

export const Rare = 2;
export const Supa = 3;
export const Uber = 4;
export const Legend = 5;

export function catNone() {
  return { name: ["N/A"] };
}

export function futureUberInfo(n) {
  return { name: [`(${n}?)`], desc: ["An unknown future uber"] };
}

const WIKI_RARITY_LABELS = {
  0: "Normal Cat",
  1: "Special Cat",
  2: "Rare Cat",
  3: "Super Rare Cat",
  4: "Uber Rare Cat",
  5: "Legend Rare Cat",
};

export class Cat {
  constructor(fields = {}) {
    Object.assign(
      this,
      {
        id: undefined,
        info: undefined,
        rarity: undefined,
        raritySeed: undefined,
        score: undefined,
        slot: undefined,
        slotSeed: undefined,
        sequence: undefined,
        track: undefined,
        steps: undefined,
        next: undefined,
        parent: undefined,
        rerolled: undefined,
        guaranteed: undefined,
        scoreRarityLabelOverride: undefined,
        pickedLabel: undefined,
        extraLabel: "",
      },
      fields
    );
  }

  get name() {
    return (this.info && this.info.name && this.info.name[0]) ?? this.id;
  }

  pickName(index) {
    if (index < 0) return undefined;
    const value = this.info?.name?.[index];
    return value !== undefined ? value : this.pickName(index - 1);
  }

  pickDescription(index) {
    if (index < 0) return undefined;
    const value = this.info?.desc?.[index];
    return value !== undefined ? value : this.pickDescription(index - 1);
  }

  pickTitle(index) {
    const pickedName = this.pickName(index);
    const names = (this.info?.name ?? [])
      .join(" | ")
      .replace(pickedName, `*${pickedName}`);
    return `${names}\n${this.pickDescription(index)}`;
  }

  get number() {
    return `${this.sequence ?? ""}${this.trackLabel}${this.extraLabel ?? ""}`;
  }

  get trackLabel() {
    if (this.track === 0 || this.track === 1) {
      return String.fromCharCode("A".charCodeAt(0) + this.track);
    }
    return "+";
  }

  equals(rhs) {
    return !!rhs && this.id === rhs.id;
  }

  duped(rhs) {
    return !!rhs && this.rarity === Rare && this.id === rhs.id && this.id > 0;
  }

  get maxLevel() {
    return this.info?.max_level;
  }

  get growth() {
    return this.info?.growth;
  }

  get talentAgainst() {
    return this.info?.talent_against;
  }

  get catRarityLabel() {
    switch (this.rarity) {
      case 2:
        return "rare";
      case 3:
        return "supa";
      case 4:
        return "uber";
      case 5:
        return "legend";
      default:
        return "rare";
    }
  }

  get scoreRarityLabel() {
    if (this.scoreRarityLabelOverride) return this.scoreRarityLabelOverride;

    const score = this.score;
    if (score == null || score < 6470) return "rare";
    if (score < 6970) return "supa_fest";
    if (score < 9070) return "supa";
    if (score < 9470) return "uber_fest";
    if (score < 9940) return "uber";
    if (score < 9970) return "legend_fest";
    return "legend";
  }

  get wikiEntryName() {
    return `${this.name} (${this.wikiRarityLabel})`.replace(/ /g, "_");
  }

  get wikiRarityLabel() {
    return Cat.wikiRarityLabel(this.info?.rarity);
  }

  static wikiRarityLabel(rarity) {
    return WIKI_RARITY_LABELS[rarity];
  }
}
