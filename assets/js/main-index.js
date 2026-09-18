import { loadBall, PREDEFINED_RATES } from "./crystalBall.js";
import { GachaPool } from "./gachaPool.js";
import { Gacha } from "./gacha.js";
import { Cat, Rare, Supa, Uber, Legend } from "./cat.js";
import { FindCat } from "./findCat.js";
import { decode as decodeOwned } from "./owned.js";
import { normalizeSeed, rubyToI } from "./rng.js";
import { currentParams, strOrNil, intOrNil, boolOrNil, replaceQuery, href } from "./params.js";

const TRACK_MAX_COUNT = 999;
const RARITY_LABEL = { [Rare]: "rare", [Supa]: "supa", [Uber]: "uber", [Legend]: "legend" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function groupedEvents(ball, eventPage) {
  const today = todayStr();
  const groups = { ongoing: [], upcoming: [], past: [] };
  for (const entry of Object.entries(ball.eventsPage(eventPage))) {
    const [, info] = entry;
    if (today <= info.start_on) groups.upcoming.push(entry);
    else if (today <= info.end_on) groups.ongoing.push(entry);
    else groups.past.push(entry);
  }
  return groups;
}

function currentEventKey(ball, eventPage) {
  const groups = groupedEvents(ball, eventPage);
  const upcoming = [...groups.ongoing, ...groups.upcoming];
  const found = upcoming.find(([, info]) => !info.platinum);
  return found ? found[0] : undefined;
}

function readState() {
  const usp = currentParams();
  return {
    lang: ["tw", "jp", "kr"].includes(strOrNil(usp, "lang")) ? strOrNil(usp, "lang") : "en",
    seed: normalizeSeed(intOrNil(usp, "seed") ?? 0),
    pos: strOrNil(usp, "pos") ?? "1A",
    last: intOrNil(usp, "last") ?? 0,
    count: Math.max(1, Math.min(intOrNil(usp, "count") ?? 100, TRACK_MAX_COUNT)),
    details: boolOrNil(usp, "details"),
    find: intOrNil(usp, "find") ?? 0,
    noGuaranteed: boolOrNil(usp, "no_guaranteed"),
    forceGuaranteed: intOrNil(usp, "force_guaranteed") ?? 0,
    ubers: Math.min(intOrNil(usp, "ubers") ?? 0, 9),
    event: strOrNil(usp, "event"),
    eventPage: Math.max(1, intOrNil(usp, "event_page") ?? 1),
    custom: intOrNil(usp, "custom"),
    rate: usp.has("rate") ? strOrNil(usp, "rate") : "predicted",
    cRare: intOrNil(usp, "c_rare"),
    cSupa: intOrNil(usp, "c_supa"),
    cUber: intOrNil(usp, "c_uber"),
    pick: strOrNil(usp, "pick"),
    o: strOrNil(usp, "o") ?? "",
  };
}

function getRate(state, ball, explicit, presetIndex) {
  if (explicit != null) return Math.min(Math.abs(explicit), 10000);
  const preset = PREDEFINED_RATES[state.rate];
  if (preset?.rate) return preset.rate[presetIndex];
  if (state.rate === "predicted") {
    const tag = ball.gacha[state.custom]?.rate ?? "regular";
    const predicted = PREDEFINED_RATES[tag]?.rate;
    if (predicted) return predicted[presetIndex];
  }
  return 0;
}

async function main() {
  const state = readState();
  const ball = await loadBall(state.lang);

  if (state.event == null) {
    state.event = currentEventKey(ball, state.eventPage) ?? "";
  }

  let pool;
  if (state.event === "custom") {
    const customId = state.custom ?? Number(Object.keys(ball.gacha).at(-1));
    state.custom = customId;
    const eventData = {
      id: customId,
      rare: getRate(state, ball, state.cRare, 0),
      supa: getRate(state, ball, state.cSupa, 1),
      uber: getRate(state, ball, state.cUber, 2),
    };
    pool = new GachaPool(ball, { eventData });
  } else {
    pool = new GachaPool(ball, { eventName: state.event });
  }

  if (state.ubers > 0) pool.addFutureUbers(state.ubers);

  const gacha = new Gacha(pool, state.seed);
  gacha.position = state.pos;

  if (state.last !== 0) {
    gacha.lastRoll = new Cat({ id: state.last });
    gacha.lastBoth = [gacha.lastRoll, null];
  }

  const owned = new Set(decodeOwned(state.o));

  const showTracks = state.seed !== 0 && pool.exist;
  let cats = [];
  let foundCats = [];

  if (showTracks) {
    for (let seq = 1; seq <= state.count; seq++) cats.push(gacha.rollBoth(seq));
    gacha.finishRerolledLinks(cats);
    if (state.last !== 0) gacha.finishLastRoll(cats[0][0]);

    const guaranteedRolls = state.forceGuaranteed > 0 ? state.forceGuaranteed : pool.guaranteedRolls;
    if (guaranteedRolls > 0) gacha.finishGuaranteed(cats, guaranteedRolls);

    if (state.pick) {
      gacha.finishPicking(cats, state.pick, guaranteedRolls);
    } else {
      gacha.markNextPosition(cats);
    }

    if (state.find) {
      foundCats = FindCat.search(gacha, state.find, {
        cats,
        guaranteed: !state.noGuaranteed,
      });
    }
  }

  renderControls(state, ball, pool, gacha);
  renderInfo(state, pool, showTracks);
  renderFound(state, foundCats);
  renderTable(state, cats, owned, showTracks);
}

function baseFields(state, overrides = {}) {
  return {
    lang: state.lang === "en" ? null : state.lang,
    seed: state.seed || null,
    pos: state.pos === "1A" ? null : state.pos,
    last: state.last || null,
    count: state.count === 100 ? null : state.count,
    details: state.details,
    find: state.find || null,
    no_guaranteed: state.noGuaranteed,
    force_guaranteed: state.forceGuaranteed || null,
    ubers: state.ubers || null,
    event: state.event || null,
    event_page: state.eventPage === 1 ? null : state.eventPage,
    custom: state.event === "custom" ? state.custom : null,
    rate: state.event === "custom" ? state.rate : null,
    c_rare: state.event === "custom" && state.rate === "" ? state.cRare : null,
    c_supa: state.event === "custom" && state.rate === "" ? state.cSupa : null,
    c_uber: state.event === "custom" && state.rate === "" ? state.cUber : null,
    o: state.o || null,
    ...overrides,
  };
}

function applyAndReload(state, overrides) {
  replaceQuery(baseFields(state, overrides));
  main();
}

function renderControls(state, ball, pool, gacha) {
  const el = document.getElementById("controls");
  const groups = groupedEvents(ball, state.eventPage);
  const upcoming = [...groups.ongoing, ...groups.upcoming];
  const inMenu = upcoming.some(([key]) => key === state.event);

  const eventOptions = [];
  if (state.eventPage > 1) eventOptions.push(`<option value="prev_page">Previous page...</option>`);
  if (state.event && state.event !== "custom" && !inMenu) {
    const selectedInfo = ball.events[state.event];
    if (selectedInfo) {
      eventOptions.push(
        `<optgroup label="Selected:"><option value="${state.event}" selected>${escapeHtml(showEvent(state.event, selectedInfo))}</option></optgroup>`
      );
    }
  }
  eventOptions.push(
    `<optgroup label="Upcoming/ongoing:">${upcoming
      .map(
        ([key, info]) =>
          `<option value="${key}" ${key === state.event ? "selected" : ""}>${escapeHtml(showEvent(key, info))}</option>`
      )
      .join("")}</optgroup>`
  );
  eventOptions.push(
    `<optgroup label="Custom:"><option value="custom" ${state.event === "custom" ? "selected" : ""}>Customize...</option></optgroup>`
  );
  eventOptions.push(`<option value="next_page">Next page...</option>`);

  let customControls = "";
  if (state.event === "custom") {
    const customOptions = [...ball.eachCustomGacha(0)]
      .map(([id, name]) => `<option value="${id}" ${Number(id) === state.custom ? "selected" : ""}>${escapeHtml(name)}</option>`)
      .join("");
    const rateOptions = Object.entries(PREDEFINED_RATES)
      .map(([key, data]) => `<option value="${key}" ${key === state.rate ? "selected" : ""}>${escapeHtml(data.name)}</option>`)
      .join("");
    const rareVal = getRate(state, ball, state.cRare, 0);
    const supaVal = getRate(state, ball, state.cSupa, 1);
    const uberVal = getRate(state, ball, state.cUber, 2);

    customControls = `
      <div class="field"><label>Custom gacha</label>
        <select id="f-custom">${customOptions}</select></div>
      <div class="field"><label>Rate preset</label>
        <select id="f-rate">${rateOptions}</select></div>
      ${
        state.rate === ""
          ? `<div class="field"><label>Rare</label><input type="number" id="f-c-rare" min="0" max="10000" value="${rareVal}"></div>
             <div class="field"><label>Super</label><input type="number" id="f-c-supa" min="0" max="10000" value="${supaVal}"></div>
             <div class="field"><label>Uber</label><input type="number" id="f-c-uber" min="0" max="10000" value="${uberVal}"></div>`
          : ""
      }`;
  }

  const lastOptions = ["", ...rarityGroupOptions(gacha)].join("");
  const findOptions = ["<option value=\"0\">(none)</option>", ...rarityGroupOptions(gacha, true)].join("");

  el.innerHTML = `
    <fieldset>
      <legend>Roll simulator</legend>
      <div class="controls-row">
        <div class="field"><label>Region</label>
          <select id="f-lang">
            ${["en", "tw", "jp", "kr"].map((l) => `<option value="${l}" ${l === state.lang ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Event</label><select id="f-event">${eventOptions.join("")}</select></div>
        ${customControls}
        <div class="field"><label>Seed</label><input type="number" id="f-seed" value="${state.seed}"></div>
        <div class="field"><label>Rolls</label><input type="number" id="f-count" min="1" max="${TRACK_MAX_COUNT}" value="${state.count}"></div>
        <div class="field"><label><input type="checkbox" id="f-details" ${state.details ? "checked" : ""}> Show details</label></div>
        <div class="field"><label>Last roll before row 1</label>
          <select id="f-last"><option value="0" ${state.last === 0 ? "selected" : ""}>(none)</option>${lastOptions}</select></div>
        <div class="field"><label>Find cat in tracks</label><select id="f-find">${findOptions}</select></div>
        ${pool.guaranteedRolls > 0 ? `<div class="field"><label><input type="checkbox" id="f-no-guaranteed" ${state.noGuaranteed ? "checked" : ""}> No guaranteed</label></div>` : ""}
        <div class="field"><label>Simulate guaranteed at</label>
          <select id="f-force-guaranteed">
            ${["0", "2", "7", "11", "15"].map((v) => `<option value="${v}" ${Number(v) === state.forceGuaranteed ? "selected" : ""}>${v === "0" ? "(auto)" : v}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Future ubers</label>
          <select id="f-ubers">${Array.from({ length: 10 }, (_, i) => `<option value="${i}" ${i === state.ubers ? "selected" : ""}>${i}</option>`).join("")}</select>
        </div>
        <div class="field"><button id="f-roll">Roll</button></div>
      </div>
    </fieldset>`;

  function rerollFromForm() {
    const overrides = {
      lang: document.getElementById("f-lang").value,
      event: document.getElementById("f-event").value,
      seed: rubyToI(document.getElementById("f-seed").value),
      count: rubyToI(document.getElementById("f-count").value) || 100,
      details: document.getElementById("f-details").checked || null,
      last: rubyToI(document.getElementById("f-last").value),
      find: rubyToI(document.getElementById("f-find").value),
      force_guaranteed: rubyToI(document.getElementById("f-force-guaranteed").value) || null,
      ubers: rubyToI(document.getElementById("f-ubers").value) || null,
      pos: null,
      pick: null,
    };
    const noGuaranteedEl = document.getElementById("f-no-guaranteed");
    if (noGuaranteedEl) overrides.no_guaranteed = noGuaranteedEl.checked || null;

    if (overrides.event === "prev_page") {
      overrides.event = null;
      overrides.event_page = Math.max(1, state.eventPage - 1);
    } else if (overrides.event === "next_page") {
      overrides.event = null;
      overrides.event_page = state.eventPage + 1;
    }

    if (overrides.event === "custom") {
      const customEl = document.getElementById("f-custom");
      const rateEl = document.getElementById("f-rate");
      if (customEl) overrides.custom = rubyToI(customEl.value);
      if (rateEl) overrides.rate = rateEl.value;
      const cRareEl = document.getElementById("f-c-rare");
      const cSupaEl = document.getElementById("f-c-supa");
      const cUberEl = document.getElementById("f-c-uber");
      if (cRareEl) overrides.c_rare = rubyToI(cRareEl.value);
      if (cSupaEl) overrides.c_supa = rubyToI(cSupaEl.value);
      if (cUberEl) overrides.c_uber = rubyToI(cUberEl.value);
    }

    state.event = overrides.event; // so baseFields' custom/rate gating is correct
    applyAndReload(state, overrides);
  }

  el.querySelector("#f-roll").addEventListener("click", rerollFromForm);
  el.querySelectorAll("select, input").forEach((elm) => {
    elm.addEventListener("change", rerollFromForm);
  });
}

function rarityGroupOptions(gacha, forFind = false) {
  const groups = [
    ["Legend", gacha.legendCats],
    ["Uber", gacha.uberCats],
    ["Super", gacha.supaCats],
    ["Rare", gacha.rareCats],
  ];
  return groups
    .filter(([, cats]) => cats.length > 0)
    .map(
      ([label, cats]) =>
        `<optgroup label="${label}">${cats
          .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.id})</option>`)
          .join("")}</optgroup>`
    );
}

function showEvent(key, info) {
  return `${info.name ?? key} (${info.start_on} ~ ${info.end_on})`;
}

function renderInfo(state, pool, showTracks) {
  const el = document.getElementById("info");
  if (!showTracks) {
    el.innerHTML = `<p class="muted">Enter a seed and pick an event to roll gacha tracks. This is a client-side port of
      <a href="https://bc.godfat.org/" target="_blank" rel="noopener">bc.godfat.org</a>'s roll simulator (seed-finding is not included).</p>`;
    return;
  }
  const rows = [
    ["Rare", pool.rare],
    ["Super", pool.supa],
    ["Uber", pool.uber],
    ["Legend", pool.legend],
  ];
  el.innerHTML = `<table><thead><tr><th>Rarity</th><th>Rate (out of 10000)</th><th>Slots</th></tr></thead>
    <tbody>${rows
      .map(([label, rate], i) => {
        const rarity = [Rare, Supa, Uber, Legend][i];
        return `<tr><td>${label}</td><td>${rate}</td><td>${pool.digSlot(rarity).length}</td></tr>`;
      })
      .join("")}</tbody></table>`;
}

function renderFound(state, foundCats) {
  const el = document.getElementById("found");
  if (!state.find || foundCats.length === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<p><strong>Found:</strong> ${foundCats
    .map((c) => `<span class="${RARITY_LABEL[c.rarity] ?? ""}">#${c.number ?? "?"} ${escapeHtml(c.name)}</span>`)
    .join(", ")}</p>`;
}

function renderTable(state, cats, owned, showTracks) {
  const el = document.getElementById("table");
  if (!showTracks) {
    el.innerHTML = "";
    return;
  }

  const showDetails = !!state.details;
  const header = `<tr><th>#</th>${showDetails ? "<th>Seed A</th><th>Seed B</th>" : ""}<th>A</th><th>AG</th><th>B</th><th>BG</th></tr>`;

  const rows = cats
    .map((ab, i) => {
      const seq = i + 1;
      const cellsExtra = showDetails
        ? `<td>${ab[0].raritySeed}</td><td>${ab[1].raritySeed}</td>`
        : "";
      const cellA = renderCatCell(state, ab[0], owned);
      const cellAG = ab[0].guaranteed ? renderCatCell(state, ab[0].guaranteed, owned) : "";
      const cellB = renderCatCell(state, ab[1], owned);
      const cellBG = ab[1].guaranteed ? renderCatCell(state, ab[1].guaranteed, owned) : "";
      return `<tr class="${pickedRowClass(ab)}"><td>${seq}</td>${cellsExtra}<td>${cellA}</td><td>${cellAG}</td><td>${cellB}</td><td>${cellBG}</td></tr>`;
    })
    .join("");

  el.innerHTML = `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`;

  el.querySelectorAll("[data-pick]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      applyAndReload(state, { pick: a.dataset.pick, pos: null });
    });
  });
}

function pickedRowClass(ab) {
  return ab.some((c) => c.pickedLabel === "next_position") ? "next-position" : "";
}

function renderCatCell(state, cat, owned) {
  if (!cat) return "";
  const classes = [RARITY_LABEL[cat.rarity] ?? ""];
  if (owned.has(cat.id)) classes.push("owned");
  const label = cat.pickedLabel ? ` (${cat.pickedLabel.replace("_", " ")})` : "";
  return `<a href="#" data-pick="${cat.number}" class="${classes.join(" ")}" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}${label}</a>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

main();
