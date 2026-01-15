// js/actions.js (globals)
(function () {
  "use strict";

  // Base actions only. Travel, guild, quests, encounters are added later.
  function buildActions() {
    return {
      home: [
        {
          id: "read",
          name: "Read a Book",
          meta: "Study quietly. Good for Intelligence.",
          timeCostMins: 120,
          durationSec: 5,
          energyCost: 8,
          effects: (s) => { s.intelligence += 4; s.magic += 1; }
        },
        {
          id: "train",
          name: "Body Training",
          meta: "Build Strength. Costs more Energy.",
          timeCostMins: 90,
          durationSec: 5,
          energyCost: 12,
          effects: (s) => { s.strength += 4; s.health = LL_STATE.clamp(s.health + 2, 0, s.healthMax); }
        },
        {
          id: "nap",
          name: "Nap",
          meta: "Short rest. Useful if you are low on time.",
          timeCostMins: 120,
          durationSec: 5,
          energyGain: 18,
          effects: (s) => { s.health = LL_STATE.clamp(s.health + 6, 0, s.healthMax); }
        },
        {
          id: "sleep",
          name: "Sleep",
          meta: "Restore Energy and Health.",
          timeCostMins: 480,
          durationSec: 5,
          energyGain: 40,
          effects: (s) => { s.health = LL_STATE.clamp(s.health + 20, 0, s.healthMax); }
        },
      ],
      town: [
        {
          id: "oddjob",
          name: "Do an Odd Job",
          meta: "Small income. Improves Charm.",
          timeCostMins: 180,
          durationSec: 5,
          energyCost: 10,
          effects: (s) => { s.charm += 2; s.gold += 18; }
        },
        {
          id: "roaderrand",
          name: "Road Errand",
          meta: "Deliver supplies along the outskirts. Risky routes.",
          timeCostMins: 240,
          durationSec: 6,
          energyCost: 12,
          encounterRisk: 0.18,
          effects: (s) => { s.charm += 1; s.gold += 28; s.luck += 1; }
        },
      ],
      guild: [
        {
          id: "registry",
          name: "Guild Registry",
          meta: "Register to access contracts and quests.",
          timeCostMins: 60,
          durationSec: 4,
          minAge: 12,
          alwaysVisible: true,
          lockedReason: "Minimum age 12. Parents will not allow earlier.",
          effects: (s) => { s.guildRegistered = true; }
        }
      ]
    };
  }

  function locations() {
    return [
      { id: "home", name: "Home", desc: "Rest, study, and train." },
      { id: "town", name: "Town", desc: "Odd jobs and services." },
      { id: "guild", name: "Guild", desc: "Register and take quests (next layer).", alwaysVisible: true },
      { id: "travel", name: "Travel", desc: "Move between towns once you reach adulthood.", minAge: 16, hideWhenLocked: true },
    ];
  }

  window.LL_ACTIONS = {
    buildActions,
    locations
  };
})();
