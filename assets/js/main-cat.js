import { loadBall } from "./crystalBall.js";
import { Stat, DEFAULT_LEVEL } from "./stat.js";
import { Cat } from "./cat.js";
import * as Talent from "./talent.js";
import { TriggeredAttack } from "./attack.js";
import { View } from "./viewHelpers.js";
import { currentParams, strOrNil, intOrNil, boolOrNil, replaceQuery } from "./params.js";

function readState() {
  const usp = currentParams();
  return {
    id: intOrNil(usp, "id") ?? 0,
    lang: ["tw", "jp", "kr"].includes(strOrNil(usp, "lang")) ? strOrNil(usp, "lang") : "en",
    level: intOrNil(usp, "level") ?? DEFAULT_LEVEL,
    speedUnit: strOrNil(usp, "speed_unit") === "pf" ? "pf" : "rs",
    excludeTalents: !!boolOrNil(usp, "exclude_talents"),
    hideWave: !!boolOrNil(usp, "hide_wave"),
    sumNoWave: boolOrNil(usp, "sum_no_wave"),
    dpsNoCritical: boolOrNil(usp, "dps_no_critical"),
  };
}

async function main() {
  const state = readState();
  const ball = await loadBall(state.lang);
  const view = new View({ speedUnit: state.speedUnit });

  const info = ball.cats[state.id];
  renderControls(state);

  const el = document.getElementById("stats");
  if (!info) {
    el.innerHTML = `<p>No such cat found.</p>`;
    return;
  }

  const cat = new Cat({ id: state.id, info });
  const talents = Talent.build(info);
  const stats = info.stat.map((_, index) => {
    const conjureId = info.stat[index]?.conjure;
    const conjureInfo = conjureId ? ball.cats[conjureId] : undefined;
    return new Stat({
      id: state.id, info, index, level: state.level, conjureInfo, cat,
      sumNoWave: state.sumNoWave, dpsNoCritical: state.dpsNoCritical,
    }).augment(state.excludeTalents ? null : talents);
  });

  el.innerHTML = renderStats(state, view, cat, info, stats, talents);
}

function renderControls(state) {
  const el = document.getElementById("controls");
  el.innerHTML = `
    <fieldset><legend>Cat #${state.id}</legend>
      <div class="controls-row">
        <div class="field"><label>Cat ID</label><input type="number" id="s-id" value="${state.id}"></div>
        <div class="field"><label>Region</label>
          <select id="s-lang">${["en", "tw", "jp", "kr"].map((l) => `<option value="${l}" ${l === state.lang ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Level</label><input type="number" id="s-level" min="1" max="999" value="${state.level}"></div>
        <div class="field"><label>Speed unit</label>
          <select id="s-speed-unit">
            <option value="rs" ${state.speedUnit === "rs" ? "selected" : ""}>r/s</option>
            <option value="pf" ${state.speedUnit === "pf" ? "selected" : ""}>pixel/frame</option>
          </select>
        </div>
        <div class="field"><label><input type="checkbox" id="s-exclude-talents" ${state.excludeTalents ? "checked" : ""}> Exclude talents (show talent list separately)</label></div>
        <div class="field"><label><input type="checkbox" id="s-hide-wave" ${state.hideWave ? "checked" : ""}> Hide wave/surge/explosion rows</label></div>
        <div class="field"><label><input type="checkbox" id="s-sum-no-wave" ${state.sumNoWave ? "checked" : ""}> Sum without wave</label></div>
        <div class="field"><label><input type="checkbox" id="s-dps-no-critical" ${state.dpsNoCritical ? "checked" : ""}> DPS without critical</label></div>
        <div class="field"><button id="s-go">Go</button></div>
      </div>
    </fieldset>`;

  function apply() {
    replaceQuery({
      id: document.getElementById("s-id").value || null,
      lang: document.getElementById("s-lang").value,
      level: document.getElementById("s-level").value === String(DEFAULT_LEVEL) ? null : document.getElementById("s-level").value,
      speed_unit: document.getElementById("s-speed-unit").value === "rs" ? null : "pf",
      exclude_talents: document.getElementById("s-exclude-talents").checked || null,
      hide_wave: document.getElementById("s-hide-wave").checked || null,
      sum_no_wave: document.getElementById("s-sum-no-wave").checked || null,
      dps_no_critical: document.getElementById("s-dps-no-critical").checked || null,
    });
    main();
  }
  el.querySelector("#s-go").addEventListener("click", apply);
  el.querySelectorAll("select, input").forEach((elm) => elm.addEventListener("change", apply));
}

function renderStats(state, view, cat, info, stats, talents) {
  const rows = stats.map((stat) => renderForm(state, view, stat)).join("");

  let talentSection = "";
  if (state.excludeTalents) {
    const byUltra = { false: [], true: [] };
    for (const t of talents) byUltra[t.ultra].push(t);

    if (byUltra.false.length) {
      talentSection += `<tr class="border_upper"><td colspan="6"><strong>Talents${cat.talentAgainst ? ` against ${escapeHtml(Array.isArray(cat.talentAgainst) ? cat.talentAgainst.join(", ") : cat.talentAgainst)}` : ""}</strong></td></tr>`;
      talentSection += byUltra.false
        .map((t) => `<tr><td>${escapeHtml(t.name)}</td><td colspan="5">${safeDisplay(() => t.display({ view }))}</td></tr>`)
        .join("");
    }
    if (byUltra.true.length) {
      talentSection += `<tr class="border_upper"><td colspan="6"><strong>Ultra talents</strong></td></tr>`;
      talentSection += byUltra.true
        .map((t) => `<tr><td>${escapeHtml(t.name)}</td><td colspan="5">${safeDisplay(() => t.display({ view }))}</td></tr>`)
        .join("");
    }
  }

  const links = `<ul>
    <li><a href="https://battlecatsstats.com/unit/${cat.id}/0" target="_blank" rel="noopener">Battle Cats Stats</a></li>
    <li><a href="https://battlecats-db.com/unit/${String(cat.id).padStart(3, "0")}.html" target="_blank" rel="noopener">にゃんこ大戦争データベース</a></li>
  </ul>`;

  return `<table class="stat-table"><tbody>${rows}${talentSection}</tbody></table>${links}`;
}

function renderForm(state, view, stat) {
  const augmented = (attr, display) => view.statAugmented(stat, attr, display ?? stat[toCamel(attr)]);

  let rows = `<tr class="border_upper"><th colspan="6">${escapeHtml(stat.name)}</th></tr>`;
  rows += `<tr><td>Health</td><td>${augmented("health")}</td><td>Knockback times</td><td>${stat.knockbacks}</td><td>Speed</td><td>${augmented("speed", view.statSpeed(stat.speed))}</td></tr>`;
  rows += `<tr><td>Production cost</td><td>${augmented("production_cost")}</td><td>Production cooldown</td><td>${augmented("production_cooldown", view.statTime(stat.productionCooldown))}</td><td>Attack cooldown</td><td>${augmented("attack_cooldown", view.statTime(stat.attackCooldown))}</td></tr>`;
  rows += `<tr><td>Attack cycle</td><td>${augmented("attack_cooldown", view.statTime(stat.attackCycle))}</td><td>Attack duration</td><td>${view.statTime(stat.attackDuration)}</td><td>Push duration</td><td>${augmented("attack_cooldown", view.statTime(stat.pushDuration))}</td></tr>`;

  if (stat.longRange) {
    rows += `<tr><td>Blind spot</td><td>${view.statRange(stat.blindSpot)}</td><td>Range</td><td>${view.statRange(stat.range)}</td><td>Enemy base range</td><td>${view.statRange(stat.baseRange)}</td></tr>`;
  }

  if (stat.attacks.length > 1) {
    rows += `<tr><td>DPS sum</td><td>${augmented("dps_sum", view.statInt(stat.dpsSum))}</td><td>Max DPS area</td><td>${view.statRange(stat.maxDpsArea)}</td><td>Damage sum</td><td>${augmented("damage_sum", stat.damageSum)}</td></tr>`;
  }

  const attacksToShow = state.hideWave ? stat.attacksRaw : stat.attacks;
  for (const attack of attacksToShow) {
    const triggered = attack instanceof TriggeredAttack;
    rows += `<tr class="border_upper"><td>DPS</td><td>${augmented("dps", view.statInt(attack.dps))}</td><td>${attack.areaType}</td><td>${view.statRange(attack.areaDisplay)}</td><td>Damage</td><td>${augmented("damage", attack.damage)}</td></tr>`;
    rows += `<tr>${
      triggered
        ? `<td colspan="2">${safeDisplay(() => attack.displayShort())}</td>`
        : `<td>Trigger duration</td><td>${view.statTime(attack.duration)}</td>`
    }<td>Trigger effects</td><td colspan="3">${
      Array.isArray(attack.displayEffects) ? attack.displayEffects.map(escapeHtml).join(", ") : escapeHtml(attack.displayEffects)
    }</td></tr>`;
  }

  for (const ability of stat.specializedAbilities) {
    rows += `<tr><td>${augmented(ability.qualifiedName, escapeIfString(ability.name))}</td><td colspan="5">${safeDisplay(() => displayAbility(ability, view, stat))}</td></tr>`;
  }
  if (stat.genericAbilities.length) {
    rows += `<tr><td></td><td colspan="5" class="muted">Abilities below will not be affected by curse</td></tr>`;
    for (const ability of stat.genericAbilities) {
      rows += `<tr><td>${augmented(ability.qualifiedName, escapeIfString(ability.name))}</td><td colspan="5">${safeDisplay(() => displayAbility(ability, view, stat))}</td></tr>`;
    }
  }

  return rows;
}

function displayAbility(ability, view, stat) {
  const result = ability.display({ view, stat });
  if (Array.isArray(result)) {
    return result.map((s) => `<strong>${escapeHtml(s)}</strong>`).join(", ");
  }
  return result;
}

function toCamel(snake) {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function safeDisplay(fn) {
  try {
    return fn();
  } catch (e) {
    return `<span class="muted">(display error: ${escapeHtml(e.message)})</span>`;
  }
}

function escapeIfString(s) {
  return typeof s === "string" ? escapeHtml(s) : s;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

main();
