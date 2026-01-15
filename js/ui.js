// js/ui.js (globals)
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let meta = 0;
  let state = null;
  let actions = null;
  let filters = null;

  let taskTimer = null;

  function fmtMins(m) {
    const d = Math.floor(m / (60 * 24));
    const h = Math.floor((m - d * 60 * 24) / 60);
    const mm = Math.abs(m % 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h || d) parts.push(`${h}h`);
    parts.push(`${mm}m`);
    return parts.join(" ");
  }

  function currentTown() {
    return state ? LL_STATE.townById(state.world, state.townId) : null;
  }

  function ensureLocationTab() {
    const locs = availableLocations();
    if (!locs.length) return;
    const exists = locs.some(l => l.id === state.locId);
    if (!exists) state.locId = locs[0].id;
  }

  function availableLocations() {
    return LL_ACTIONS.locations().filter(loc => {
      if (loc.minAge && state.age < loc.minAge) return !loc.hideWhenLocked;
      return true;
    });
  }

  function renderTop() {
    $("topPills").innerHTML = `
      <span class="pill"><span class="mono">Meta</span> <b class="mono">${meta}</b></span>
      ${state ? `<span class="pill"><span class="mono">Age</span> <b class="mono">${state.age}</b></span>` : ""}
    `;
  }

  function renderLanding() {
    $("metaPoints").textContent = meta;

    // Families
    if ($("selFamily").options.length === 0) {
      for (const f of LL_STATE.FAMILIES) {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.name;
        $("selFamily").appendChild(opt);
      }
      $("selFamily").value = LL_STATE.FAMILIES[0].id;
    }
    const fam = LL_STATE.FAMILIES.find(f => f.id === $("selFamily").value) || LL_STATE.FAMILIES[0];
    $("familyDesc").textContent = fam.desc;

    $("screenLanding").style.display = "grid";
    $("screenGame").style.display = "none";
  }

  function renderCharacterList() {
    const lines = [];
    lines.push(`<div><span class="hl mono">${escapeHtml(state.name)}</span> (${escapeHtml(LL_STATE.displayGender(state))})</div>`);
    const town = currentTown();
    if (town && town.name) lines.push(`<div>Town: <span class="mono">${escapeHtml(town.name)}</span></div>`);
    lines.push(`<div>Age: <span class="mono">${state.age}</span></div>`);
    lines.push(`<div>Stage time: <span class="mono">${fmtMins(state.stageRemainingMins)}</span> / <span class="mono">${fmtMins(state.stageTotalMins)}</span></div>`);
    lines.push(`<div>Energy: <span class="mono">${state.energy}/${state.energyMax}</span> · Health: <span class="mono">${state.health}/${state.healthMax}</span></div>`);
    lines.push(`<div>Gold: <span class="mono">${state.gold}</span></div>`);
    lines.push(`<div class="divider"></div>`);
    lines.push(`<div>INT <span class="mono">${state.intelligence}</span> · STR <span class="mono">${state.strength}</span> · MAG <span class="mono">${state.magic}</span></div>`);
    lines.push(`<div>CHA <span class="mono">${state.charm}</span> · LUCK <span class="mono">${state.luck}</span></div>`);
    $("charList").innerHTML = `<div class="small">${lines.join("")}</div>`;
  }

  function renderTabs() {
    const locs = availableLocations();
    ensureLocationTab();
    $("locTabs").innerHTML = locs.map(l => {
      const active = (state.locId === l.id) ? "active" : "";
      return `<div class="tab ${active}" data-loc="${l.id}">${escapeHtml(l.name)}</div>`;
    }).join("");
  }

  function getActionsForLoc(locId) {
    if (locId === "travel") return buildTravelActions();
    return (actions[locId] || []).slice();
  }

  function buildTravelActions() {
    if (!state || !state.world) return [];
    if (!state.townId) return [];
    const towns = LL_STATE.listVisibleTowns(state.world);
    const fromId = state.townId;
    return towns.filter(t => t.id !== fromId).map(town => {
      const dist = LL_STATE.distanceUnits(state.world, fromId, town.id);
      const timeCostMins = LL_STATE.travelTimeMins(state.world, fromId, town.id);
      return {
        id: `travel_${town.id}`,
        name: `Travel to ${town.name}`,
        meta: `A 10s trip. Distance: ${dist.toFixed(1)}.`,
        timeCostMins,
        durationSec: 10,
        travelTo: town.id,
        travelFrom: fromId,
      };
    });
  }

  function renderLocationPanel() {
    const locs = availableLocations();
    const loc = locs.find(l => l.id === state.locId) || locs[0];

    const list = getActionsForLoc(loc.id);
    const filtered = list.filter(a => isActionVisible(a));
    const cards = filtered.map(a => renderActionCard(a, loc.id)).join("");

    $("locationPanel").innerHTML = `
      <div><b>${escapeHtml(loc.name)}</b></div>
      <div class="small">${escapeHtml(loc.desc)}</div>
      <div class="divider"></div>
      <div class="actions">${cards || `<div class="small">(No actions)</div>`}</div>
    `;
  }

  function isActionVisible(action) {
    if (action.alwaysVisible) return true;
    if (action.minAge && state.age < action.minAge) return false;
    if (typeof action.requires === "function" && !action.requires(state)) return false;
    return true;
  }

  function actionLockedReason(action) {
    if (action.minAge && state.age < action.minAge) return action.lockedReason || `Requires age ${action.minAge}.`;
    if (typeof action.requires === "function" && !action.requires(state)) return action.lockedReason || "Not available yet.";
    return "";
  }

  function renderActionCard(a, locId) {
    const qFull = state.queue.length >= 10;
    const isRunning = state.task.running;

    // Stage-time overflow rule (later): for base we already allow overflow (no blocking).
    const lockedReason = actionLockedReason(a);
    const locked = Boolean(lockedReason);
    const disabled = locked;

    const parts = [];
    if (a.timeCostMins) parts.push(`Time: ${fmtMins(a.timeCostMins)}`);
    if (a.durationSec) parts.push(`Real: ${a.durationSec}s`);
    if (a.energyCost) parts.push(`Energy: -${a.energyCost}`);
    if (a.energyGain) parts.push(`Energy: +${a.energyGain}`);

    const btnLabel = locked ? "Locked" : (isRunning ? "Queue" : "Do it");

    return `
      <div class="action">
        <b>${escapeHtml(a.name)}</b>
        <div class="small">${escapeHtml(a.meta || "")}</div>
        ${locked ? `<div class="small">${escapeHtml(lockedReason)}</div>` : ``}
        <div class="small">${escapeHtml(parts.join(" · "))}</div>
        <div style="margin-top:auto">
          <div class="row">
            <button ${disabled ? "disabled" : ""} data-action="${a.id}" data-loc="${locId}">${btnLabel}</button>
            ${locId === "home" ? `
              <button class="secondary" ${qFull ? "disabled" : ""} data-q="${5}" data-action="${a.id}" data-loc="${locId}">x5</button>
              <button class="secondary" ${qFull ? "disabled" : ""} data-q="${10}" data-action="${a.id}" data-loc="${locId}">x10</button>
            ` : ``}
          </div>
        </div>
      </div>
    `;
  }

  function renderQueue() {
    const q = state.queue;
    $("btnClearQueue").disabled = q.length === 0 || state.task.running;
    if (q.length === 0) {
      $("queueList").innerHTML = `<div class="small">(Empty)</div>`;
      return;
    }
    $("queueList").innerHTML = q.map((it, idx) => `
      <div class="qItem">
        <div class="small"><span class="hl">${escapeHtml(it.name)}</span> <span class="mono">(${escapeHtml(it.locId)})</span></div>
        <button class="secondary" data-qrm="${idx}">Remove</button>
      </div>
    `).join("");
  }

  function renderLogFilters() {
    const bits = LL_LOG.TYPES.map(t => {
      const checked = filters[t] ? "checked" : "";
      return `<label class="small"><input type="checkbox" data-lf="${t}" ${checked}/> ${t}</label>`;
    }).join("");
    $("logFilters").innerHTML = bits;
  }

  function renderLog() {
    const entries = state.log.filter(e => filters[e.type] !== false);
    $("log").innerHTML = entries.map(e => `
      <div class="entry">
        <div class="t">${escapeHtml(e.t)} · <span class="mono">${escapeHtml(e.type)}</span></div>
        <div>${escapeHtml(e.msg)}</div>
      </div>
    `).join("");
  }

  function renderEncounter() {
    const overlay = $("encounterOverlay");
    if (!state || !state.encounter || !state.encounter.active) {
      overlay.style.display = "none";
      return;
    }
    const data = state.encounter.data;
    $("encounterTitle").textContent = data.title;
    $("encounterDesc").textContent = data.desc;
    $("encounterOptions").innerHTML = data.options.map(opt => `
      <button ${opt.disabled ? "disabled" : ""} data-enc="${opt.id}">${escapeHtml(opt.label)}</button>
    `).join("");
    overlay.style.display = "flex";
  }

  function renderGame() {
    $("screenLanding").style.display = "none";
    $("screenGame").style.display = "grid";

    renderCharacterList();
    renderTabs();
    renderLocationPanel();
    renderQueue();
    renderLogFilters();
    renderLog();
    renderEncounter();
  }

  function render() {
    renderTop();
    if (!state) {
      renderLanding();
      renderEncounter();
    } else {
      renderGame();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function enqueue(locId, action) {
    const free = 10 - state.queue.length;
    if (free <= 0) {
      LL_LOG.add(state, "queue", "Queue is full (max 10).");
      return;
    }
    state.queue.push({ locId, actionId: action.id, name: action.name });
    LL_LOG.add(state, "queue", `Queued: ${action.name}.`);
  }

  function startTask(action, locId) {
    // Overflow stage time: allow negative (carry to next stage later)
    const cost = action.timeCostMins || 0;
    state.stageRemainingMins -= cost;

    if (action.energyCost) state.energy = LL_STATE.clamp(state.energy - action.energyCost, 0, state.energyMax);
    if (action.energyGain) state.energy = LL_STATE.clamp(state.energy + action.energyGain, 0, state.energyMax);

    state.task = {
      running: true,
      locId,
      actionId: action.id,
      name: action.name,
      data: {
        travelTo: action.travelTo || null,
        travelFrom: action.travelFrom || null,
        encounterRisk: action.encounterRisk || 0,
      },
      startedAt: Date.now(),
      durationMs: Math.max(1, (action.durationSec || 1) * 1000),
    };

    LL_LOG.add(state, "system", `Started: ${action.name}.`);
    if (taskTimer) clearInterval(taskTimer);
    taskTimer = setInterval(tickTask, 80);
  }

  function completeTask() {
    const locId = state.task.locId;
    const actionId = state.task.actionId;
    const action = getActionsForLoc(locId).find(a => a.id === actionId);
    if (action && typeof action.effects === "function") action.effects(state);

    LL_LOG.add(state, "system", `Completed: ${state.task.name}.`);

    if (state.task.data && state.task.data.travelTo) {
      const from = LL_STATE.townById(state.world, state.task.data.travelFrom);
      state.townId = state.task.data.travelTo;
      const to = currentTown();
      const fromName = from && from.name ? from.name : "Unknown";
      const toName = to && to.name ? to.name : "Unknown";
      LL_LOG.add(state, "travel", `Arrived in ${toName} from ${fromName}.`);
      pruneQueueForLocation();
      state.locId = "town";
    }

    state.task.running = false;
    state.task.locId = null;
    state.task.actionId = null;
    state.task.name = null;
    state.task.data = null;

    // Simple age-up rule in base: if stage time <= 0, age up
    if (state.stageRemainingMins <= 0) {
      applyAgeUp(false);
    }

    render();
    if (!maybeTriggerEncounter(action)) {
      maybeStartNext();
    }
  }

  function applyAgeUp(skipTime) {
    state.age += 1;
    const overflow = skipTime ? 0 : state.stageRemainingMins;
    state.stageTotalMins = 7 * 24 * 60;
    state.stageRemainingMins = state.stageTotalMins + overflow;
    LL_LOG.add(state, "system", `You age up. Now age ${state.age}.`);
    checkLandInvite();
  }

  function checkLandInvite() {
    if (!state.story.pendingLandInvite || state.story.landGranted) return;
    state.story.pendingLandInvite = false;
    state.story.landGranted = true;
    state.rentCost = 0;
    const town = LL_STATE.revealGrantTown(state.world, state.familyName);
    if (town && town.name) {
      LL_LOG.add(state, "story", `A royal messenger arrives with a land grant. ${town.name} is founded in your family name.`);
    } else {
      LL_LOG.add(state, "story", "A royal messenger arrives with a land grant.");
    }
  }

  function pruneQueueForLocation() {
    const before = state.queue.length;
    state.queue = state.queue.filter(item => {
      const locAllowed = availableLocations().some(l => l.id === item.locId);
      if (!locAllowed) return false;
      const list = getActionsForLoc(item.locId);
      const action = list.find(a => a.id === item.actionId);
      return Boolean(action) && isActionVisible(action);
    });
    const removed = before - state.queue.length;
    if (removed > 0) LL_LOG.add(state, "queue", `${removed} queued action(s) were removed after travel.`);
  }

  function maybeTriggerEncounter(action) {
    if (!action || !action.encounterRisk) return false;
    if (state.encounter && state.encounter.active) return true;
    if (Math.random() > action.encounterRisk) return false;
    const data = buildEncounter();
    state.encounter = { active: true, data };
    LL_LOG.add(state, "travel", "Something interrupts your journey...");
    renderEncounter();
    return true;
  }

  function buildEncounter() {
    const attackers = Math.random() < 0.55 ? "bandits" : "beasts";
    const caravan = pickCaravanType();
    if (caravan === "royal") state.story.royalCaravanSeen = true;

    const title = "Caravan in Trouble";
    const desc = `You spot a ${caravan} caravan under attack by ${attackers}.`;
    const options = [];

    options.push({ id: "headon", label: "Attack head-on" });
    const sneakDisabled = attackers === "beasts";
    options.push({
      id: "sneak",
      label: sneakDisabled ? "Sneak attack (unavailable)" : "Sneak attack",
      disabled: sneakDisabled,
    });
    options.push({ id: "ignore", label: "Ignore and leave" });

    return { attackers, caravan, title, desc, options };
  }

  function pickCaravanType() {
    if (!state.story.royalCaravanResolved && !state.story.royalCaravanSeen && Math.random() < 0.15) {
      return "royal";
    }
    return Math.random() < 0.55 ? "merchant" : "transport";
  }

  function resolveEncounter(choice) {
    const data = state.encounter.data;
    state.encounter.active = false;
    state.encounter.data = null;
    if (data.caravan === "royal") {
      state.story.royalCaravanResolved = true;
    }

    if (choice === "ignore") {
      LL_LOG.add(state, "story", "You leave the caravan behind.");
      render();
      maybeStartNext();
      return;
    }

    const deathChance = computeDeathChance(data, choice);
    if (Math.random() < deathChance) {
      LL_LOG.add(state, "combat", "You fall in the skirmish.");
      endRun("Fell defending a caravan.");
      return;
    }

    const reward = computeReward(data, choice);
    state.gold += reward;
    LL_LOG.add(state, "combat", `You help drive off the attackers and earn ${reward} gold.`);

    if (data.caravan === "royal") checkRoyalInvite();

    render();
    maybeStartNext();
  }

  function computeDeathChance(data, choice) {
    const attackerBase = data.attackers === "beasts" ? 0.5 : 0.42;
    const caravanMod = data.caravan === "royal" ? -0.08 : (data.caravan === "merchant" ? 0.05 : 0);
    const choiceMod = choice === "headon" ? 0.12 : -0.08;
    const statMitigation = (state.strength / 220) + (state.luck / 260);
    return LL_STATE.clamp(attackerBase + caravanMod + choiceMod - statMitigation, 0.05, 0.85);
  }

  function computeReward(data, choice) {
    const base = data.caravan === "royal" ? 140 : (data.caravan === "merchant" ? 80 : 45);
    const mod = choice === "headon" ? 1.15 : 1;
    return Math.floor(base * mod);
  }

  function checkRoyalInvite() {
    if (state.story.landGranted || state.story.pendingLandInvite) return;
    const luckFactor = state.luck / 100;
    if (state.age < LL_STATE.ADULT_AGE && state.strength > 80 && Math.random() < 0.25 + luckFactor) {
      state.story.pendingLandInvite = true;
      LL_LOG.add(state, "story", "Word of your bravery spreads beyond the roads.");
    }
  }

  function endRun(reason) {
    LL_LOG.add(state, "system", reason);
    state = null;
    render();
  }

  function tickTask() {
    if (!state.task.running) return;
    const elapsed = Date.now() - state.task.startedAt;
    if (elapsed >= state.task.durationMs) {
      clearInterval(taskTimer);
      taskTimer = null;
      completeTask();
      return;
    }
  }

  function maybeStartNext() {
    if (state.task.running) return;
    if (state.encounter && state.encounter.active) return;
    if (state.queue.length === 0) return;

    const next = state.queue.shift();
    const action = getActionsForLoc(next.locId).find(a => a.id === next.actionId);
    if (!action) {
      LL_LOG.add(state, "queue", "A queued action was missing and was skipped.");
      render();
      return;
    }
    startTask(action, next.locId);
    render();
  }

  function saveLocal() {
    LL_STATE.saveLocal({ meta, state });
    LL_LOG.add(state, "system", "Saved locally.");
    render();
  }

  function downloadSave() {
    const snapshot = { meta, state };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-loop-save-v4-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    LL_LOG.add(state, "system", "Save downloaded.");
  }

  function loadFromObject(obj) {
    if (!obj || !obj.state) return false;
    meta = (typeof obj.meta === "number") ? obj.meta : LL_STATE.defaultMeta();
    state = obj.state;
    // normalize
    state.queue = state.queue || [];
    state.log = state.log || [];
    state.task = { running: false, locId: null, actionId: null, name: null, data: null, startedAt: 0, durationMs: 0 };
    state.world = state.world || LL_STATE.buildWorld();
    state.townId = state.townId || (LL_STATE.randomVisibleTown(state.world) || {}).id || null;
    state.locId = state.locId || "home";
    state.encounter = state.encounter || { active: false, data: null };
    state.story = {
      royalCaravanSeen: false,
      royalCaravanResolved: false,
      pendingLandInvite: false,
      landGranted: false,
      ...state.story,
    };
    state.rentCost = Number.isFinite(state.rentCost) ? state.rentCost : 10;
    filters = filters || LL_LOG.defaultFilterState();
    return true;
  }

  function wireLanding() {
    $("selFamily").addEventListener("change", render);
    $("btnStart").addEventListener("click", () => {
      const nm = ($("inpName").value || "Alex").trim().slice(0, 20) || "Alex";
      const gender = $("selGender").value;
      const famId = $("selFamily").value;
      const famName = ($("inpFamilyName").value || "").trim().slice(0, 18) || LL_STATE.generateFamilyName();

      state = LL_STATE.freshState();
      state.name = nm;
      state.gender = gender;
      state.familyId = famId;
      state.familyName = famName;
      state.world = LL_STATE.buildWorld();
      const startTown = LL_STATE.randomVisibleTown(state.world);
      state.townId = startTown ? startTown.id : null;
      state.locId = "home";
      state.encounter = { active: false, data: null };

      LL_STATE.applyFamilyMods(state);

      actions = LL_ACTIONS.buildActions();
      filters = LL_LOG.defaultFilterState();

      LL_LOG.add(state, "story", "A familiar feeling you cannot name—like waking from a dream you already lived.");
      const town = currentTown();
      if (town && town.name) LL_LOG.add(state, "story", `You open your eyes in ${town.name}.`);
      render();
    });

    $("btnReset").addEventListener("click", () => {
      LL_STATE.clearLocalAll();
      meta = 0;
      state = null;
      render();
    });
  }

  function wireGame() {
    $("locTabs").addEventListener("click", (e) => {
      const tab = e.target.closest("[data-loc]");
      if (!tab) return;
      state.locId = tab.getAttribute("data-loc");
      render();
    });

    $("locationPanel").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const locId = btn.getAttribute("data-loc");
      const actionId = btn.getAttribute("data-action");
      const action = getActionsForLoc(locId).find(a => a.id === actionId);
      if (!action) return;
      const lockedReason = actionLockedReason(action);
      if (lockedReason) {
        LL_LOG.add(state, "system", lockedReason);
        render();
        return;
      }

      const q = btn.getAttribute("data-q");
      if (q) {
        const n = parseInt(q, 10) || 1;
        const free = 10 - state.queue.length;
        const add = Math.min(free, n);
        for (let i = 0; i < add; i++) enqueue(locId, action);
        render();
        if (!state.task.running) maybeStartNext();
        return;
      }

      if (state.task.running) {
        enqueue(locId, action);
        render();
        return;
      }

      startTask(action, locId);
      render();
    });

    $("queueList").addEventListener("click", (e) => {
      const rm = e.target.closest("button[data-qrm]");
      if (!rm) return;
      const idx = parseInt(rm.getAttribute("data-qrm"), 10);
      if (!Number.isFinite(idx)) return;
      state.queue.splice(idx, 1);
      LL_LOG.add(state, "queue", "Removed queued action.");
      render();
    });

    $("btnClearQueue").addEventListener("click", () => {
      if (state.task.running) return;
      state.queue = [];
      LL_LOG.add(state, "queue", "Queue cleared.");
      render();
    });

    $("btnDebugEncounter").addEventListener("click", () => {
      if (!state || state.task.running) return;
      if (state.encounter && state.encounter.active) return;
      state.encounter = { active: true, data: buildEncounter() };
      LL_LOG.add(state, "system", "Debug encounter triggered.");
      render();
    });

    $("btnAgeUp").addEventListener("click", () => {
      if (state.task.running) return;
      // Player-chosen skip: lose remaining time entirely (fair drawback)
      state.stageRemainingMins = 0;
      LL_LOG.add(state, "system", "You choose to age up early, losing remaining time.");
      applyAgeUp(true);
      render();
    });

    $("btnSave").addEventListener("click", () => { if (state) saveLocal(); });
    $("btnDownload").addEventListener("click", () => { if (state) downloadSave(); });
    $("btnLoad").addEventListener("click", () => $("fileLoad").click());

    $("fileLoad").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const obj = JSON.parse(text);
        if (!loadFromObject(obj)) alert("Save not compatible with this base.");
        render();
      } catch {
        alert("Could not load save file.");
      }
    });

    $("btnGiveUp").addEventListener("click", () => {
      if (!state || state.task.running) return;
      // In base, we just return to landing (meta/summary comes later)
      endRun("Run ended (stub summary).");
    });

    $("logFilters").addEventListener("change", (e) => {
      const cb = e.target.closest("input[data-lf]");
      if (!cb) return;
      const t = cb.getAttribute("data-lf");
      filters[t] = cb.checked;
      render();
    });

    $("encounterOptions").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-enc]");
      if (!btn || !state || !state.encounter || !state.encounter.active) return;
      if (btn.disabled) return;
      resolveEncounter(btn.getAttribute("data-enc"));
    });
  }

  function boot() {
    meta = LL_STATE.defaultMeta();
    $("inpName").value = "Alex";
    $("selGender").value = "male";

    // Setup state defaults for game screen
    actions = LL_ACTIONS.buildActions();
    filters = LL_LOG.defaultFilterState();

    wireLanding();
    wireGame();

    render();
  }

  window.LL_UI = { boot };
})();
