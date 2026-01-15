// js/log.js (globals)
(function () {
  "use strict";

  const TYPES = ["system", "queue", "combat", "story", "travel"];

  function nowHHMM() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function add(state, type, msg) {
    if (!TYPES.includes(type)) type = "system";
    state.log.unshift({ t: nowHHMM(), type, msg: String(msg) });
    if (state.log.length > 250) state.log.length = 250;
  }

  function defaultFilterState() {
    return { system: true, queue: true, combat: true, story: true, travel: true };
  }

  window.LL_LOG = {
    TYPES,
    add,
    defaultFilterState,
  };
})();
