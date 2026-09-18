// Port of the formatting helpers in lib/battle-cats-rolls/view.rb that
// Ability/Talent display() methods call into (stat_time/stat_range/
// stat_speed/stat_int/stat_augmented), plus uri_to_cat.

import { FPS } from "./stat.js";

export class View {
  constructor({ speedUnit = "rs" } = {}) {
    this.speedUnit = speedUnit;
  }

  statTime(frames) {
    if (typeof frames === "number") {
      const seconds = Math.round((frames / FPS) * 100) / 100;
      return `<span title="${frames} frames">${seconds}s</span>`;
    }
    return frames ?? "-";
  }

  statRange(range) {
    if (typeof range === "number") return `${range}r`;
    return String(range).replace(/(\d+)/g, "$1r");
  }

  statSpeed(speed) {
    if (typeof speed === "number") {
      return this.speedUnit === "pf" ? `${speed}p/f` : `${speed * 15}r/s`;
    }
    return speed ?? "-";
  }

  statInt(number) {
    if (typeof number === "number") return Math.round(number);
    if (number == null) return "?";
    return number;
  }

  statAugmented(stat, attribute, value) {
    const talents = stat?.augmentingTalents?.[attribute];
    if (talents && talents.length) {
      const cssClass = talents.some((t) => t.ultra) ? "augmented_ultra" : "augmented_regular";
      return `<span class="augmented ${cssClass}">${value}</span>`;
    }
    return value;
  }

  uriToCat(id) {
    return `cat.html?id=${id}`;
  }
}
