import { loadBall, groupByRarity } from "./crystalBall.js";
import * as Filter from "./filter.js";
import { View } from "./viewHelpers.js";
import { encode as encodeOwned, decode as decodeOwned } from "./owned.js";
import { currentParams, strOrNil, intOrNil, boolOrNil, arrayParam, replaceQuery } from "./params.js";
import { DEFAULT_LEVEL } from "./stat.js";

const RARITY_NAMES = { 0: "Normal", 1: "Special", 2: "Rare", 3: "Super Rare", 4: "Uber Rare", 5: "Legend Rare" };
const view = new View();

function readState() {
  const usp = currentParams();
  const single = (key, def) => strOrNil(usp, key) ?? def;
  return {
    lang: ["tw", "jp", "kr"].includes(strOrNil(usp, "lang")) ? strOrNil(usp, "lang") : "en",
    level: intOrNil(usp, "level") ?? DEFAULT_LEVEL,
    excludeTalents: !!boolOrNil(usp, "exclude_talents"),
    sumNoWave: boolOrNil(usp, "sum_no_wave"),
    dpsNoCritical: boolOrNil(usp, "dps_no_critical"),
    advancedFilters: !!boolOrNil(usp, "advanced_filters"),
    forAgainst: single("for_against", "all"),
    against: arrayParam(usp, "against"),
    buff: arrayParam(usp, "buff"),
    forResistant: single("for_resistant", "or"),
    resistant: arrayParam(usp, "resistant"),
    range: arrayParam(usp, "range"),
    area: single("area", "any"),
    forControl: single("for_control", "any"),
    control: arrayParam(usp, "control"),
    forImmunity: single("for_immunity", "any"),
    immunity: arrayParam(usp, "immunity"),
    forCounter: single("for_counter", "any"),
    counter: arrayParam(usp, "counter"),
    forCombat: single("for_combat", "any"),
    combat: arrayParam(usp, "combat"),
    forOther: single("for_other", "all"),
    other: arrayParam(usp, "other"),
    rarity: arrayParam(usp, "rarity"),
    dps: single("dps", "any"),
    damage: single("damage", "any"),
    health: single("health", "any"),
    knockbacks: single("knockbacks", "any"),
    stand: single("stand", "any"),
    reach: single("reach", "any"),
    speed: single("speed", "any"),
    cost: single("cost", "any"),
    production: single("production", "any"),
    forAspect: single("for_aspect", "all"),
    aspect: arrayParam(usp, "aspect"),
    o: strOrNil(usp, "o") ?? "",
  };
}

async function main() {
  const state = readState();
  const ball = await loadBall(state.lang);

  const chain = new Filter.Chain({ ...ball.cats }, {
    level: state.level,
    excludeTalents: state.excludeTalents,
    sumNoWave: state.sumNoWave,
    dpsNoCritical: state.dpsNoCritical,
  });

  const fromResistant = state.forResistant === "or" ? state.resistant : [];

  chain.filter(state.against, state.forAgainst, Filter.Specialization);
  chain.filter([...state.buff, ...fromResistant], "any", { ...Filter.Buff, ...Filter.Resistant });
  if (state.forResistant === "and") {
    chain.filter(state.resistant, "any", Filter.Resistant);
  }
  chain.filter(state.range, "any", Filter.RangeFilters);
  if (state.area !== "any") chain.filter([state.area], "any", Filter.Area);
  chain.filter(state.control, state.forControl, Filter.Control);
  chain.filter(state.immunity, state.forImmunity, Filter.Immunity);
  chain.filter(state.counter, state.forCounter, Filter.Counter);
  chain.filter(state.combat, state.forCombat, Filter.Combat);
  chain.filter(state.other, state.forOther, Filter.Other);
  chain.filter(state.rarity, "any", Filter.Rarity);
  if (state.dps !== "any") chain.filter([state.dps], "any", Filter.DPS);
  if (state.damage !== "any") chain.filter([state.damage], "any", Filter.Damage);
  if (state.health !== "any") chain.filter([state.health], "any", Filter.Health);
  if (state.knockbacks !== "any") chain.filter([state.knockbacks], "any", Filter.Knockbacks);
  if (state.stand !== "any") chain.filter([state.stand], "any", Filter.Stand);
  if (state.reach !== "any") chain.filter([state.reach], "any", Filter.Reach);
  if (state.speed !== "any") chain.filter([state.speed], "any", Filter.Speed);
  if (state.cost !== "any") chain.filter([state.cost], "any", Filter.Cost);
  if (state.production !== "any") chain.filter([state.production], "any", Filter.Production);
  chain.filter(state.aspect, state.forAspect, Filter.Aspect);

  renderControls(state);
  renderFilters(state);
  renderCats(state, groupByRarity(chain.cats));
}

function persist(overrides) {
  const usp = currentParams();
  const fields = Object.fromEntries(usp.entries());
  // arrays lost via Object.fromEntries; rebuild multi-value keys properly below.
  const multiKeys = ["against", "buff", "resistant", "range", "control", "immunity", "counter", "combat", "other", "rarity", "aspect"];
  for (const key of multiKeys) fields[key] = currentParams().getAll(key);
  Object.assign(fields, overrides);
  replaceQuery(fields);
  main();
}

function renderControls(state) {
  const el = document.getElementById("controls");
  el.innerHTML = `
    <fieldset>
      <legend>Options</legend>
      <div class="controls-row">
        <div class="field"><label>Region</label>
          <select id="c-lang">${["en", "tw", "jp", "kr"].map((l) => `<option value="${l}" ${l === state.lang ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Level</label><input type="number" id="c-level" min="1" max="999" value="${state.level}"></div>
        <div class="field"><label><input type="checkbox" id="c-exclude-talents" ${state.excludeTalents ? "checked" : ""}> Exclude talents</label></div>
        <div class="field"><label><input type="checkbox" id="c-advanced" ${state.advancedFilters ? "checked" : ""}> Advanced filters</label></div>
        <div class="field"><label><input type="checkbox" id="c-sum-no-wave" ${state.sumNoWave ? "checked" : ""}> Sum DPS/damage without wave</label></div>
        <div class="field"><label><input type="checkbox" id="c-dps-no-critical" ${state.dpsNoCritical ? "checked" : ""}> DPS without critical/savage blow</label></div>
      </div>
    </fieldset>`;

  el.querySelector("#c-lang").addEventListener("change", (e) => persist({ lang: e.target.value }));
  el.querySelector("#c-level").addEventListener("change", (e) => persist({ level: e.target.value }));
  el.querySelector("#c-exclude-talents").addEventListener("change", (e) => persist({ exclude_talents: e.target.checked ? "true" : "" }));
  el.querySelector("#c-advanced").addEventListener("change", (e) => persist({ advanced_filters: e.target.checked ? "true" : "" }));
  el.querySelector("#c-sum-no-wave").addEventListener("change", (e) => persist({ sum_no_wave: e.target.checked ? "true" : "" }));
  el.querySelector("#c-dps-no-critical").addEventListener("change", (e) => persist({ dps_no_critical: e.target.checked ? "true" : "" }));
}

function humanize(key) {
  return String(key)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelFor(table, key) {
  const entry = table[key];
  if (entry && typeof entry.display === "function") {
    try {
      return `${humanize(key)} (${entry.display(view)})`;
    } catch {
      return humanize(key);
    }
  }
  return humanize(key);
}

function checkboxGroup({ title, name, table, selected, forName, forOptions, forSelected }) {
  const toggle = forName
    ? `<div class="for-toggle">${forOptions
        .map(
          (opt) =>
            `<label><input type="radio" name="${forName}" value="${opt}" ${opt === forSelected ? "checked" : ""}> ${opt}</label>`
        )
        .join(" ")}</div>`
    : "";
  const boxes = Object.keys(table)
    .map(
      (key) =>
        `<label><input type="checkbox" name="${name}" value="${key}" ${selected.includes(key) ? "checked" : ""}> ${labelFor(table, key)}</label>`
    )
    .join("");
  return `<div class="filter-group"><h3>${title}</h3>${toggle}${boxes}</div>`;
}

function singleSelectGroup({ title, name, table, selected }) {
  const options = ["any", ...Object.keys(table)]
    .map((key) => `<option value="${key}" ${key === selected ? "selected" : ""}>${key === "any" ? "(any)" : labelFor(table, key)}</option>`)
    .join("");
  return `<div class="filter-group"><h3>${title}</h3><select name="${name}">${options}</select></div>`;
}

function renderFilters(state) {
  const el = document.getElementById("filters");

  const groups = [
    checkboxGroup({ title: "Specialization", name: "against", table: Filter.Specialization, selected: state.against, forName: "for_against", forOptions: ["all", "any"], forSelected: state.forAgainst }),
    checkboxGroup({ title: "Buff", name: "buff", table: Filter.Buff, selected: state.buff }),
    checkboxGroup({ title: "Resistant", name: "resistant", table: Filter.Resistant, selected: state.resistant, forName: "for_resistant", forOptions: ["or", "and"], forSelected: state.forResistant }),
    checkboxGroup({ title: "Range", name: "range", table: Filter.RangeFilters, selected: state.range }),
    singleSelectGroup({ title: "Area", name: "area", table: Filter.Area, selected: state.area }),
    checkboxGroup({ title: "Control", name: "control", table: Filter.Control, selected: state.control, forName: "for_control", forOptions: ["any", "all"], forSelected: state.forControl }),
    checkboxGroup({ title: "Immunity", name: "immunity", table: Filter.Immunity, selected: state.immunity, forName: "for_immunity", forOptions: ["any", "all"], forSelected: state.forImmunity }),
    checkboxGroup({ title: "Counter", name: "counter", table: Filter.Counter, selected: state.counter, forName: "for_counter", forOptions: ["any", "all"], forSelected: state.forCounter }),
    checkboxGroup({ title: "Combat", name: "combat", table: Filter.Combat, selected: state.combat, forName: "for_combat", forOptions: ["any", "all"], forSelected: state.forCombat }),
    checkboxGroup({ title: "Other", name: "other", table: Filter.Other, selected: state.other, forName: "for_other", forOptions: ["all", "any"], forSelected: state.forOther }),
  ];

  if (state.advancedFilters) {
    groups.push(
      checkboxGroup({ title: "Rarity", name: "rarity", table: Filter.Rarity, selected: state.rarity }),
      singleSelectGroup({ title: "DPS", name: "dps", table: Filter.DPS, selected: state.dps }),
      singleSelectGroup({ title: "Single blow damage", name: "damage", table: Filter.Damage, selected: state.damage }),
      singleSelectGroup({ title: "Health", name: "health", table: Filter.Health, selected: state.health }),
      singleSelectGroup({ title: "Knockbacks", name: "knockbacks", table: Filter.Knockbacks, selected: state.knockbacks }),
      singleSelectGroup({ title: "Stand", name: "stand", table: Filter.Stand, selected: state.stand }),
      singleSelectGroup({ title: "Reach", name: "reach", table: Filter.Reach, selected: state.reach }),
      singleSelectGroup({ title: "Speed", name: "speed", table: Filter.Speed, selected: state.speed }),
      singleSelectGroup({ title: "Cost", name: "cost", table: Filter.Cost, selected: state.cost }),
      singleSelectGroup({ title: "Production cooldown", name: "production", table: Filter.Production, selected: state.production }),
      checkboxGroup({ title: "Aspect", name: "aspect", table: Filter.Aspect, selected: state.aspect, forName: "for_aspect", forOptions: ["all", "any"], forSelected: state.forAspect })
    );
  }

  el.innerHTML = `<form id="filter-form"><div class="filter-groups">${groups.join("")}</div>
    <p><button type="submit">Apply filters</button></p></form>`;

  el.querySelector("#filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const overrides = {};
    const multi = ["against", "buff", "resistant", "range", "control", "immunity", "counter", "combat", "other", "rarity", "aspect"];
    for (const key of multi) overrides[key] = form.getAll(key);
    for (const key of ["for_against", "for_resistant", "for_control", "for_immunity", "for_counter", "for_combat", "for_other", "for_aspect", "area", "dps", "damage", "health", "knockbacks", "stand", "reach", "speed", "cost", "production"]) {
      const v = form.get(key);
      if (v != null) overrides[key] = v === "any" ? "" : v;
    }
    persist(overrides);
  });
}

function renderCats(state, catsByRarity) {
  const el = document.getElementById("cats");
  const owned = new Set(decodeOwned(state.o));

  const sections = Object.entries(catsByRarity)
    .map(([rarity, cats]) => {
      const entries = Object.entries(cats);
      if (entries.length === 0) return "";
      const tiles = entries
        .map(
          ([id, info]) =>
            `<label><input type="checkbox" class="tick" value="${id}" ${owned.has(Number(id)) ? "checked" : ""}> #${id} ${escapeHtml(info.name?.[0] ?? "")}</label>`
        )
        .join("");
      return `<h3>${RARITY_NAMES[rarity] ?? rarity} (${entries.length})</h3><div class="cats-grid">${tiles}</div>`;
    })
    .join("");

  el.innerHTML = `<p><button id="save-owned">Save ownership</button> <span class="muted">Tick cats you own, then save. Stored compactly in the URL's "o" param.</span></p>${sections}`;

  el.querySelector("#save-owned").addEventListener("click", () => {
    const ids = [...el.querySelectorAll(".tick:checked")].map((c) => Number(c.value));
    persist({ o: encodeOwned(ids) });
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

main();
