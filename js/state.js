// js/state.js (globals)
(function () {
  "use strict";

  const META_KEY = "ll_v4_meta";
  const SAVE_KEY = "ll_v4_save";

  const ADULT_AGE = 16;

  const FAMILIES = [
    { id: "humble", name: "Humble Home", desc: "Balanced start.", mods: { gold: 20 } },
    { id: "merchant", name: "Merchant Family", desc: "More gold, a bit more luck.", mods: { gold: 60, luck: 2 } },
    { id: "scholar", name: "Scholar Household", desc: "More intelligence and magic.", mods: { gold: 25, intelligence: 4, magic: 3 } },
    { id: "woodsman", name: "Woodsman Cabin", desc: "More strength and health.", mods: { gold: 15, strength: 5, healthMax: 10 } },
  ];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateFamilyName() {
    const a = ["Val", "Ar", "Kor", "Fen", "Ryn", "Sol", "Mar", "Eld", "Vyr", "Kai", "Nor", "Sel", "Drav", "Lun"];
    const b = ["en", "is", "or", "wyn", "eth", "ric", "dor", "lan", "mir", "vane", "holt", "crest"];
    return randItem(a) + randItem(b);
  }

  function defaultMeta() {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (parseInt(raw, 10) || 0) : 0;
  }

  function setMeta(v) {
    localStorage.setItem(META_KEY, String(Math.max(0, Math.floor(v))));
  }

  function freshState() {
    return {
      version: 4,
      alive: true,
      name: "Alex",
      gender: "male",
      familyName: "Valen",
      familyId: "humble",

      // In base, we avoid mentioning towns/ownership entirely.
      // This will be introduced later behind story flags.

      age: 7,
      stageTotalMins: 7 * 24 * 60,
      stageRemainingMins: 7 * 24 * 60,

      intelligence: 5,
      strength: 5,
      magic: 3,
      charm: 3,
      luck: 3,

      energyMax: 100,
      healthMax: 100,
      energy: 80,
      health: 100,

      gold: 20,

      queue: [], // { locId, actionId }
      task: { running: false, locId: null, actionId: null, name: null, startedAt: 0, durationMs: 0 },

      // Story flags (town/land grant will come later)
      story: { },

      // Log is stored as typed entries
      log: [],
    };
  }

  function applyFamilyMods(s) {
    const fam = FAMILIES.find(f => f.id === s.familyId) || FAMILIES[0];
    const mods = fam.mods || {};
    for (const [k, v] of Object.entries(mods)) {
      if (k === "gold") s.gold += v;
      else if (k === "healthMax") s.healthMax = clamp(s.healthMax + v, 50, 999);
      else if (k === "energyMax") s.energyMax = clamp(s.energyMax + v, 50, 999);
      else s[k] = clamp((s[k] || 0) + v, 0, 999);
    }
    s.energy = clamp(s.energy, 0, s.energyMax);
    s.health = clamp(s.health, 0, s.healthMax);
  }

  function displayGender(s) {
    const adult = s.age >= ADULT_AGE;
    if (s.gender === "male") return adult ? "Male" : "Boy";
    if (s.gender === "female") return adult ? "Female" : "Girl";
    return String(s.gender || "");
  }

  function saveLocal(snapshot) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
  }

  function loadLocal() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function clearLocalAll() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(META_KEY);
  }

  // Public API
  window.LL_STATE = {
    ADULT_AGE,
    FAMILIES,
    clamp,
    generateFamilyName,
    defaultMeta,
    setMeta,
    freshState,
    applyFamilyMods,
    displayGender,
    saveLocal,
    loadLocal,
    clearLocalAll,
  };
})();
