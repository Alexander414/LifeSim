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
    const locs = LL_ACTIONS.locations();
    $("locTabs").innerHTML = locs.map(l => {
      const active = (state.locId === l.id) ? "active" : "";
      return `<div class="tab ${active}" data-loc="${l.id}">${escapeHtml(l.name)}</div>`;
    }).join("");
  }

  function getActionsForLoc(locId) {
    return (actions[locId] || []).slice();
  }

  function renderLocationPanel() {
    const locs = LL_ACTIONS.locations();
    const loc = locs.find(l => l.id === state.locId) || locs[0];

    const list = getActionsForLoc(loc.id);
    const cards = list.map(a => renderActionCard(a, loc.id)).join("");

    $("locationPanel").innerHTML = `
      <div><b>${escapeHtml(loc.name)}</b></div>
      <div class="small">${escapeHtml(loc.desc)}</div>
      <div class="divider"></div>
      <div class="actions">${cards || `<div class="small">(No actions)</div>`}</div>
    `;
  }

  function renderActionCard(a, locId) {
    const qFull = state.queue.length >= 10;
    const isRunning = state.task.running;

    // Stage-time overflow rule (later): for base we already allow overflow (no blocking).
    const disabled = false;

    const parts = [];
    if (a.timeCostMins) parts.push(`Time: ${fmtMins(a.timeCostMins)}`);
    if (a.durationSec) parts.push(`Real: ${a.durationSec}s`);
    if (a.energyCost) parts.push(`Energy: -${a.energyCost}`);
    if (a.energyGain) parts.push(`Energy: +${a.energyGain}`);

    const btnLabel = isRunning ? "Queue" : "Do it";

    return `
      <div class="action">
        <b>${escapeHtml(a.name)}</b>
        <div class="small">${escapeHtml(a.meta || "")}</div>
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

  function renderGame() {
    $("screenLanding").style.display = "none";
    $("screenGame").style.display = "grid";

    renderCharacterList();
    renderTabs();
    renderLocationPanel();
    renderQueue();
    renderLogFilters();
    renderLog();
  }

  function render() {
    renderTop();
    if (!state) renderLanding();
    else renderGame();
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

    state.task.running = false;
    state.task.locId = null;
    state.task.actionId = null;
    state.task.name = null;

    // Simple age-up rule in base: if stage time <= 0, age up
    if (state.stageRemainingMins <= 0) {
      state.age += 1;
      // Reset and carry overflow (negative remainder is already applied by being <= 0)
      const overflow = state.stageRemainingMins; // negative or 0
      state.stageTotalMins = 7 * 24 * 60;
      state.stageRemainingMins = state.stageTotalMins + overflow;
      LL_LOG.add(state, "system", `You age up. Now age ${state.age}.`);
    }

    render();
    maybeStartNext();
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
    state.task = { running: false, locId: null, actionId: null, name: null, startedAt: 0, durationMs: 0 };
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

      LL_STATE.applyFamilyMods(state);

      actions = LL_ACTIONS.buildActions();
      filters = LL_LOG.defaultFilterState();

      LL_LOG.add(state, "story", "A familiar feeling you cannot name—like waking from a dream you already lived.");
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

    $("btnAgeUp").addEventListener("click", () => {
      if (state.task.running) return;
      // Player-chosen skip: lose remaining time entirely (fair drawback)
      state.stageRemainingMins = 0;
      LL_LOG.add(state, "system", "You choose to age up early, losing remaining time.");
      // Trigger age up immediately
      state.age += 1;
      state.stageTotalMins = 7 * 24 * 60;
      state.stageRemainingMins = state.stageTotalMins;
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
      LL_LOG.add(state, "system", "Run ended (stub summary).");
      // In base, we just return to landing (meta/summary comes later)
      state = null;
      render();
    });

    $("logFilters").addEventListener("change", (e) => {
      const cb = e.target.closest("input[data-lf]");
      if (!cb) return;
      const t = cb.getAttribute("data-lf");
      filters[t] = cb.checked;
      render();
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
