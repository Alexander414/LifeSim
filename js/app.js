import { ADULT_AGE, RANKS } from './constants.js';
import { BASE_TOWNS, FAMILIES, CLASSES, ITEM_NAMES, getGearById, gearLabel } from './data.js';
import { createActionsApi } from './actions.js';

(function(){
  // ---------------------------
  // Utilities
  // ---------------------------
  const $ = (id)=>document.getElementById(id);
  const clamp = (n, a, b)=>Math.max(a, Math.min(b, n));
  const rnd = (a,b)=>Math.random()*(b-a)+a;
  const nowHHMM = ()=>new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function displayGender(s){
    const adult = (s.age >= ADULT_AGE);
    if(s.gender === 'male') return adult ? 'Male' : 'Boy';
    if(s.gender === 'female') return adult ? 'Female' : 'Girl';
    return String(s.gender||'');
  }

  function fmtTime(minutes){
    const d = Math.floor(minutes / (60*24));
    const h = Math.floor((minutes - d*60*24)/60);
    const m = minutes % 60;
    const parts=[];
    if(d>0) parts.push(`${d}d`);
    if(h>0 || d>0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  }

  function rankIndex(r){ return RANKS.indexOf(r); }

  function req(ok, why=''){ return {ok, why}; }

  // ---------------------------
  // World (Kingdom) data
  // ---------------------------
  function randomFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function generateFamilyName(){
    const a = ['Val','Ar','Kor','Fen','Ryn','Sol','Mar','Eld','Vyr','Kai','Nor','Sel','Drav','Lun','Aster'];
    const b = ['en','is','or','wyn','a','eth','ric','dor','lan','mir','vane','holt','crest','field','mere'];
    return randomFrom(a) + randomFrom(b);
  }

  // ---------------------------
  // Content Tables
  // ---------------------------
  // ---------------------------
  // Storage
  // ---------------------------
  const STORAGE_KEY = 'lifeLoopPrototype_v4_save';
  const META_KEY = 'lifeLoopPrototype_v4_meta';
  const WORLD_KEY = 'lifeLoopPrototype_v4_world';

  function defaultMeta(){
    const raw = localStorage.getItem(META_KEY);
    return raw ? (parseInt(raw,10)||0) : 0;
  }
  function setMeta(v){
    localStorage.setItem(META_KEY, String(Math.max(0, Math.floor(v))));
  }

  function freshWorld(){
    const towns = BASE_TOWNS.map(t=>({
      id: t.id,
      name: t.name,
      kind: t.kind,
      desc: t.desc,
      hidden: !!t.hidden,
      unlocked: !t.hidden,
      facilities: { blacksmith: !t.hidden, store: !t.hidden, infrastructure: false },
      travelTier: t.id.startsWith('city_') ? 3 : 2,
    }));

    return {
      version: 4,
      towns,
      story: {
        landGrantEverUnlocked: false,
      }
    };
  }

  function loadWorld(){
    const raw = localStorage.getItem(WORLD_KEY);
    if(!raw) return freshWorld();
    try{
      const w = JSON.parse(raw);
      if(!w || w.version !== 4 || !Array.isArray(w.towns)) return freshWorld();
      for(const t of w.towns){
        t.facilities = t.facilities || { blacksmith: false, store: false, infrastructure: false };
        if(typeof t.unlocked !== 'boolean') t.unlocked = !t.hidden;
        if(typeof t.hidden !== 'boolean') t.hidden = false;
        if(typeof t.travelTier !== 'number') t.travelTier = t.id.startsWith('city_') ? 3 : 2;
      }
      w.story = w.story || { landGrantEverUnlocked:false };
      if(typeof w.story.landGrantEverUnlocked !== 'boolean') w.story.landGrantEverUnlocked = false;
      return w;
    } catch {
      return freshWorld();
    }
  }

  function saveWorld(){
    localStorage.setItem(WORLD_KEY, JSON.stringify(world));
  }

  // ---------------------------
  // State
  // ---------------------------
  function freshState(){
    return {
      version: 4,
      name: 'Alex',
      gender: 'male',
      familyId: 'humble',
      familyName: 'Valen',
      classId: 'none',

      currentTownId: null,
      currentLocationId: 'home',
      ownedTownId: null,

      age: 7,
      stage: 'Childhood',
      stageIndex: 0,
      stageTotalMins: 7*24*60,
      stageRemainingMins: 7*24*60,

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
      inventory: {},
      gear: { weaponId:'none', armorId:'none' },

      homeLocked: false,
      rentFree: false,

      guild: { registered:false, rank:'F', xp:0, questsCompleted:0 },
      buffs: { supplies: 0 },

      queue: [],

      flags: {
        foundCaravanEvent: false,
        savedNobleChild: false,
        landGrantPendingInvite: false,
      },

      lifetimeActions: 0,
      lifetimeAdventures: 0,

      alive: true,
      causeOfDeath: null,

      log: [],
      task: { running:false, actionId:null, actionName:null, startedAt:0, durationMs:0, locationId:null, townId:null },
    };
  }

  let metaPoints = defaultMeta();
  let world = loadWorld();
  let state = null;

  // ---------------------------
  // Derived / Balance
  // ---------------------------
  function classMods(s){
    const c = CLASSES.find(x=>x.id===s.classId) || CLASSES[0];
    return c.mods || {};
  }

  function computeGuildStartRank(s){
    const score = (s.strength*1.0 + s.magic*1.0 + s.intelligence*0.8 + s.luck*0.6 + s.charm*0.4);
    if(score >= 90) return 'B';
    if(score >= 72) return 'C';
    if(score >= 55) return 'D';
    if(score >= 40) return 'E';
    return 'F';
  }

  function stageConfig(stageIndex){
    const stages = [
      { name:'Childhood', daysPerStep: 7, deathAgeFactor: 0.00 },
      { name:'Teen',      daysPerStep: 10, deathAgeFactor: 0.01 },
      { name:'Adult',     daysPerStep: 14, deathAgeFactor: 0.02 },
      { name:'Elder',     daysPerStep: 14, deathAgeFactor: 0.05 },
    ];
    return stages[clamp(stageIndex,0,stages.length-1)];
  }

  function ensureStageTime(s){
    const cfg = stageConfig(s.stageIndex);
    s.stage = cfg.name;
    const total = cfg.daysPerStep * 24 * 60;
    s.stageTotalMins = total;
    s.stageRemainingMins = clamp(s.stageRemainingMins, 0, total);
  }

  function naturalOldAgeRisk(s){
    const t = clamp((s.age - 60) / 30, 0, 1);
    const base = 0.005 + 0.06 * t;
    const mitigate = (s.health/Math.max(1,s.healthMax))*0.02 + (s.strength/100)*0.01;
    return clamp(base - mitigate, 0.001, 0.12);
  }

  function gearRiskMitigation(s){
    const w = getGearById(s.gear?.weaponId || 'none');
    const a = getGearById(s.gear?.armorId || 'none');
    return clamp((w.riskMitigate||0) + (a.riskMitigate||0), 0, 0.12);
  }

  function gearPowerBonus(s){
    const w = getGearById(s.gear?.weaponId || 'none');
    const a = getGearById(s.gear?.armorId || 'none');
    return clamp((w.power||0) + (a.power||0), 0, 80);
  }

  function computeAdventureDeathChance(s, baseRisk){
    const mods = classMods(s);

    const gMit = gearRiskMitigation(s);
    const gPow = gearPowerBonus(s);

    const power = (s.strength*0.8 + s.magic*0.8 + s.intelligence*0.4 + s.luck*0.6) + gPow;
    const powerMitigate = clamp(power / 220, 0, 0.40);

    const healthFactor = 0.10 * (1 - (s.health / Math.max(1,s.healthMax)));
    const energyFactor = 0.08 * (1 - (s.energy / Math.max(1,s.energyMax)));

    const ageCfg = stageConfig(s.stageIndex);
    const ageFactor = ageCfg.deathAgeFactor;

    const supplyMitigate = clamp(s.buffs.supplies, 0, 0.04);
    const classMitigate = clamp(mods.riskMitigate || 0, 0, 0.06);

    let p = baseRisk + healthFactor + energyFactor + ageFactor;
    p = p - powerMitigate - supplyMitigate - classMitigate - gMit;
    return clamp(p, 0.005, 0.85);
  }

  function computeMetaBreakdown(s){
    const statSum = s.intelligence + s.strength + s.magic + s.charm + s.luck;
    const statPoints = Math.floor(statSum/5);

    const rankPoints = (rankIndex(s.guild.rank) + 1);
    const questPoints = Math.min(60, s.guild.questsCompleted * 6);
    const goldPoints = Math.min(50, Math.floor(s.gold / 20));
    const agePoints = Math.min(40, Math.floor((s.age - 7) / 2));
    const invQty = Object.values(s.inventory||{}).reduce((a,b)=>a+b,0);
    const invPoints = Math.min(30, Math.floor(invQty/3));

    const townPoints = (s.ownedTownId ? 25 : 0);
    const facilityCount = (s.ownedTownId ? Object.values(getTownById(s.ownedTownId)?.facilities || {}).filter(Boolean).length : 0);
    const facilityPoints = Math.min(30, facilityCount * 10);

    const parts = [
      { label:'Stats', value: statPoints, detail:`(sum ${statSum} ÷ 5)` },
      { label:'Guild Rank', value: rankPoints, detail:`(rank ${s.guild.rank})` },
      { label:'Quests', value: questPoints, detail:`(${s.guild.questsCompleted} × 6, capped 60)` },
      { label:'Gold', value: goldPoints, detail:`(gold ${s.gold} ÷ 20, capped 50)` },
      { label:'Age', value: agePoints, detail:`(age ${s.age})` },
      { label:'Inventory', value: invPoints, detail:`(qty ${invQty} ÷ 3, capped 30)` },
      { label:'Town Granted', value: townPoints, detail: s.ownedTownId ? '(land grant unlocked)' : '(none)' },
      { label:'Town Facilities', value: facilityPoints, detail:`(${facilityCount} built)` },
    ];

    const total = Math.max(0, parts.reduce((a,p)=>a+p.value,0));
    return { total, parts };
  }

  // ---------------------------
  // Town helpers
  // ---------------------------
  function getTownById(id){
    return world.towns.find(t=>t.id===id) || null;
  }

  function visibleTownsIncludingOwnedUnnamed(){
    return world.towns.filter(t=>t.unlocked && t.name);
  }

  function townLabel(t){
    if(!t) return 'Unknown';
    return `${t.name} (${t.kind})`;
  }

  function travelCostMinutes(fromTownId, toTownId){
    const a = getTownById(fromTownId);
    const b = getTownById(toTownId);
    if(!a || !b) return 480;
    const tier = Math.max(1, Math.abs((a.travelTier||2) - (b.travelTier||2)));
    return clamp(480 * tier, 480, 1440);
  }

  // ---------------------------
  // Inventory helpers
  // ---------------------------
  function addItem(inv, itemId, qty){
    inv[itemId] = (inv[itemId]||0) + qty;
    if(inv[itemId] <= 0) delete inv[itemId];
  }
  function removeItem(inv, itemId, qty){
    if(!inv[itemId]) return false;
    inv[itemId] -= qty;
    if(inv[itemId] <= 0) delete inv[itemId];
    return true;
  }
  function invLine(itemId, qty){
    const name = ITEM_NAMES[itemId] || itemId;
    return `${name} x${qty}`;
  }

  // ---------------------------
  // Locations per town
  // ---------------------------
  function locationsForTown(townId){
    const t = getTownById(townId);
    if(!t) return [];

    const locs = [
      { id:'home', name:'Home', desc:'Rest, study, and train safely.' },
      { id:'town', name:'Town', desc:'Shops, odd jobs, rumors, and town services.' },
      { id:'guild', name:"Adventurers' Guild", desc:'Register, take quests, raise rank.' },
      { id:'forest', name:'Forest', desc:'Gather herbs, hunt small monsters.' },
      { id:'mine', name:'Mine', desc:'Mine ore with some risk.' },
      { id:'travel', name:'Travel', desc:'Move between towns and cities (16+).' },
    ];

    if(state?.ownedTownId && state.ownedTownId === townId){
      locs.push({ id:'development', name:'Development', desc:'Invest in your town. Facilities persist across lives.' });
    }

    return locs;
  }

  // ---------------------------
  // Actions (data defined in js/actions.js)
  // ---------------------------
  const actionsApi = createActionsApi({
    req,
    rankIndex,
    getTownById,
    saveWorld,
    removeItem,
  });

  let ACTIONS = actionsApi.buildActions();

  // ---------------------------
  // Logging + Story
  // ---------------------------
  function log(msg){
    state.log.unshift({ t: nowHHMM(), msg });
    state.log = state.log.slice(0, 180);
    render();
  }

  function storyOnce(key, message){
    if(state.flags[key]) return;
    state.flags[key] = true;
    log(`Story: ${message}`);
  }

  // ---------------------------
  // Queue
  // ---------------------------
  function queueSize(){ return state.queue.length; }

  function actionName(locId, actionId, townId){
    const list = getActionsForLocation(locId, townId);
    const a = list.find(x=>x.id===actionId);
    return a ? a.name : actionId;
  }

  function enqueueAction(locId, actionId, count){
    count = clamp(count, 1, 10);
    const free = 10 - queueSize();
    if(free <= 0){
      log('Queue is full (max 10).');
      return;
    }
    const add = Math.min(free, count);
    for(let i=0;i<add;i++) state.queue.push({ locId, actionId, townId: state.currentTownId });
    log(`Queued: ${actionName(locId, actionId, state.currentTownId)} x${add}.`);
    maybeStartNextFromQueue();
    render();
  }

  function clearQueue(){
    state.queue = [];
    log('Queue cleared.');
    render();
  }

  function removeQueueIndex(idx){
    state.queue.splice(idx,1);
    render();
    maybeStartNextFromQueue();
  }

  function pruneQueueForTownChange(newTownId){
    const before = state.queue.length;
    state.queue = state.queue.filter(q=>{
      const availableLocs = new Set(locationsForTown(newTownId).map(l=>l.id));
      if(!availableLocs.has(q.locId)) return false;
      const list = getActionsForLocation(q.locId, newTownId);
      return list.some(a=>a.id===q.actionId);
    });
    const removed = before - state.queue.length;
    if(removed > 0) log(`Travel safety: removed ${removed} queued task(s) not available in the new town.`);
  }

  function maybeStartNextFromQueue(){
    if(!state || state.task.running || !state.alive) return;

    while(state.queue.length > 0){
      const next = state.queue[0];
      const action = getActionsForLocation(next.locId, state.currentTownId).find(a=>a.id===next.actionId);
      if(!action){
        state.queue.shift();
        continue;
      }
      const ok = canStartAction(action, next.locId);
      if(!ok.ok){
        log(`Skipped queued action "${action.name}": ${ok.why}`);
        state.queue.shift();
        continue;
      }
      state.queue.shift();
      startTask(action, next.locId, true);
      break;
    }
  }

  // ---------------------------
  // Task Runner
  // ---------------------------
  let taskTimer = null;

  function getPlannedTravelCost(){
    const sel = $('selTravelTo');
    const dest = sel ? sel.value : null;
    if(!dest || !state || !state.currentTownId) return 0;
    if(dest === state.currentTownId) return 0;
    return travelCostMinutes(state.currentTownId, dest);
  }

  function canStartAction(action, locationId){
    if(locationId === 'home' && state.homeLocked){
      return req(false, 'Home is locked. Earn gold and rent a room in Town.');
    }

    const r = action.requirements ? action.requirements(state) : req(true);
    if(!r.ok) return r;

    if(action.special === 'travel'){
      const dest = $('selTravelTo')?.value || null;
      if(!dest || dest === state.currentTownId) return req(false, 'Select a destination town.');
    }

    const timeCost = action.special === 'travel' ? getPlannedTravelCost() : (action.timeCostMins || 0);
    if(state.stageRemainingMins < timeCost) return req(false, `Not enough stage time (need ${fmtTime(timeCost)}).`);

    return req(true);
  }

  function startTask(action, locationId, fromQueue=false){
    if(state.task.running) return;

    const ok = canStartAction(action, locationId);
    if(!ok.ok){
      log(`Cannot do "${action.name}": ${ok.why}`);
      return;
    }

    let travelTo = null;
    let timeCost = action.timeCostMins || 0;
    if(action.special === 'travel'){
      travelTo = $('selTravelTo')?.value || null;
      if(!travelTo || travelTo === state.currentTownId){
        log('Choose a destination town before traveling.');
        return;
      }
      timeCost = travelCostMinutes(state.currentTownId, travelTo);
    }

    state.stageRemainingMins -= timeCost;
    if(action.energyCost) state.energy = clamp(state.energy - action.energyCost, 0, state.energyMax);

    if(action.rewards && typeof action.rewards.gold === 'number'){
      state.gold = clamp(state.gold + action.rewards.gold, 0, 999999);
      action._goldApplied = true;
    } else {
      action._goldApplied = false;
    }

    if(action.id === 'shopSupplies'){
      state.buffs.supplies = 0.03;
      storyOnce('bought_supplies', 'You realize preparation is its own kind of strength.');
      log('You buy supplies. Next adventure is slightly safer.');
    }

    state.task = {
      running: true,
      actionId: action.id,
      actionName: action.name,
      startedAt: Date.now(),
      durationMs: (action.durationSec||5)*1000,
      locationId,
      townId: state.currentTownId,
      travelTo,
      travelTimeCost: timeCost,
    };

    state.lifetimeActions += 1;
    if(action.adventure) state.lifetimeAdventures += 1;

    const prefix = fromQueue ? 'Auto-started' : 'Started';
    log(`${prefix}: ${action.name} (${fmtTime(timeCost)}).`);

    if(taskTimer) clearInterval(taskTimer);
    taskTimer = setInterval(tickTask, 80);
    render();
  }

  function applyLoot(loot){
    if(!loot || !Array.isArray(loot) || loot.length===0) return [];
    const mods = classMods(state);
    const mult = clamp(mods.lootMult || 1, 1, 2);

    const gained = [];
    for(const l of loot){
      const q = Math.floor(rnd(l.min, l.max+1) * mult);
      if(q <= 0) continue;
      addItem(state.inventory, l.id, q);
      gained.push({id:l.id, qty:q});
    }
    return gained;
  }

  function applyStatGains(statGains){
    if(!statGains) return;
    const mods = classMods(state);

    for(const [k,v0] of Object.entries(statGains)){
      let v = v0;
      if(k === 'magic') v = Math.round(v0 * (mods.magicGainMult || 1));
      if(k === 'luck') v = Math.round(v0 * (mods.luckGainMult || 1));
      state[k] = clamp(state[k] + v, 0, 999);
    }
  }

  function recalcGuildRank(){
    const thresholds = { F: 0, E: 20, D: 60, C: 120, B: 200, A: 320, S: 480 };
    let best = 'F';
    for(const r of RANKS){ if(state.guild.xp >= thresholds[r]) best = r; }
    if(best !== state.guild.rank){
      state.guild.rank = best;
      log(`Guild rank increased to ${best}.`);
      if(best === 'D') storyOnce('rank_d', 'Your name starts showing up in conversations you were never part of.');
      if(best === 'B') storyOnce('rank_b', 'The guild master looks at you differently now—measuring, careful.');
    }
  }

  function tryTriggerCaravanEvent(){
    if(state.flags.foundCaravanEvent) return;

    const base = 0.02;
    const luckBoost = clamp(state.luck / 200, 0, 0.06);
    const chance = base + luckBoost;

    if(Math.random() >= chance) return;

    state.flags.foundCaravanEvent = true;

    const eligibleForNoble = (!world.story.landGrantEverUnlocked) && (state.age < ADULT_AGE) && (state.strength > 80);
    const nobleChance = eligibleForNoble ? clamp(0.10 + (state.luck/150), 0.10, 0.35) : 0;

    if(eligibleForNoble && Math.random() < nobleChance){
      state.flags.savedNobleChild = true;
      state.flags.landGrantPendingInvite = true;
      log('Story: You find a carriage under attack. You intervene—fast, decisive. A terrified noble child survives because you were there.');
      log('Story: Rumors spread faster than you can walk.');
    } else {
      log('Story: You find a wagon under attack. You help drive off the attackers and ensure the survivors reach the gates.');
      log('Story: It feels like the world briefly notices you—and then keeps moving.');
    }
  }

  function grantLandAndUnlockTown(){
    if(world.story.landGrantEverUnlocked) return;
    if(!state.flags.landGrantPendingInvite) return;

    state.flags.landGrantPendingInvite = false;

    const slot = world.towns.find(t=>t.id==='hidden_1');
    if(!slot) return;

    slot.hidden = false;
    slot.unlocked = true;
    slot.name = state.familyName;
    slot.kind = 'Town';
    slot.desc = 'A newly granted domain, yours to oversee.';
    slot.facilities = slot.facilities || { blacksmith:false, store:false, infrastructure:false };

    world.story.landGrantEverUnlocked = true;
    saveWorld();

    state.ownedTownId = slot.id;
    state.rentFree = true;

    log('Story: After your next birthday, a royal messenger arrives. You are summoned.');
    log(`Story: The king grants you land to oversee. A town will bear your family name: ${state.familyName}.`);
    log('Story: Your rent is waived for the rest of this life.');
  }

  function completeTask(){
    const loc = state.task.locationId;
    const townId = state.task.townId;

    if(state.task.actionId === 'travelToTown'){
      const dest = state.task.travelTo;
      state.task.running = false;
      state.task.actionId = null;
      state.task.actionName = null;
      state.task.locationId = null;
      state.task.townId = null;

      const prev = state.currentTownId;
      state.currentTownId = dest;
      state.currentLocationId = 'town';

      pruneQueueForTownChange(dest);
      log(`You travel from ${townLabel(getTownById(prev))} to ${townLabel(getTownById(dest))}.`);

      ageUpIfNeeded();
      render();
      maybeStartNextFromQueue();
      return;
    }

    const action = getActionsForLocation(loc, townId).find(a=>a.id===state.task.actionId);
    if(!action){
      state.task.running = false;
      maybeStartNextFromQueue();
      return;
    }

    if(action.energyGain) state.energy = clamp(state.energy + action.energyGain, 0, state.energyMax);
    if(action.rewards){
      if(typeof action.rewards.health === 'number') state.health = clamp(state.health + action.rewards.health, 0, state.healthMax);
      if(typeof action.rewards.gold === 'number' && !action._goldApplied) state.gold = clamp(state.gold + action.rewards.gold, 0, 999999);
      if(typeof action.rewards.guildXP === 'number'){
        const mods = classMods(state);
        const mult = clamp(mods.guildXPMult || 1, 1, 2);
        state.guild.xp += Math.round(action.rewards.guildXP * mult);
        state.guild.questsCompleted += 1;
        recalcGuildRank();
      }
    }

    applyStatGains(action.statGains);

    if(action.id === 'register'){
      state.guild.registered = true;
      state.guild.rank = computeGuildStartRank(state);
      log(`Guild registration complete. Starting rank: ${state.guild.rank}.`);
      storyOnce('guild_registered', 'A stamped card and a quiet warning: the world is not kind to the unprepared.');
    }

    if(action.onComplete){
      action.onComplete(state);
      if(action.id === 'chooseClass'){
        const c = CLASSES.find(x=>x.id===state.classId);
        log(`Class chosen: ${c ? c.name : state.classId}.`);
      }

      if(action.id.startsWith('build')){
        log('Story: The town changes. People notice. You are no longer just surviving; you are shaping.');
      }

      if(action.id.startsWith('smith')){
        storyOnce('blacksmith_first', 'The blacksmith weighs your materials like fate, then nods once: "It will hold."');
        log(`Equipped: Weapon=${gearLabel(state.gear.weaponId)} · Armor=${gearLabel(state.gear.armorId)}`);
      }

      if(action.id === 'rentRoom'){
        storyOnce('home_restored', 'A small room, a locked door, and the rare luxury of safety.');
      }
    }

    if(action.adventure){
      const chance = computeAdventureDeathChance(state, action.adventure.baseRisk);
      const died = Math.random() < chance;
      const riskPct = (chance*100).toFixed(1);

      state.buffs.supplies = 0;

      if(died){
        die(`Fell during "${action.name}" (death chance was ${riskPct}%).`);
        return;
      }

      const gained = applyLoot(action.adventure.loot);
      if(gained.length>0){
        log(`Loot: ${gained.map(x=>invLine(x.id,x.qty)).join(', ')}.`);
      }

      if(action.adventure.travelLike) tryTriggerCaravanEvent();

      log(`Completed adventure safely. (Death chance was ${riskPct}%).`);
      state.health = clamp(state.health - Math.floor(rnd(0,3)), 0, state.healthMax);
    } else {
      log(`Completed: ${action.name}.`);
    }

    state.task.running = false;
    state.task.actionId = null;
    state.task.actionName = null;
    state.task.locationId = null;
    state.task.townId = null;
    state.task.travelTo = null;

    ageUpIfNeeded();
    render();
    maybeStartNextFromQueue();
  }

  function tickTask(){
    if(!state || !state.task.running) return;
    const elapsed = Date.now() - state.task.startedAt;
    if(elapsed >= state.task.durationMs){
      clearInterval(taskTimer);
      taskTimer = null;
      completeTask();
      return;
    }

    const tPct = 100 * (elapsed / Math.max(1,state.task.durationMs));
    const taskLineEl = $('taskLine');
    const taskBarEl  = $('taskBar');
    if(taskLineEl && taskBarEl){
      taskLineEl.innerHTML = `Running: <span class="hl">${escapeHtml(state.task.actionName)}</span>`;
      taskBarEl.style.width = `${clamp(tPct,0,100)}%`;
    }
  }

  // ---------------------------
  // Aging & Story
  // ---------------------------
  function storyBeatOnAge(age){
    if(age === 8) storyOnce('age8', 'You notice how adults talk around problems instead of through them.');
    if(age === 10) storyOnce('age10', 'You start noticing what people avoid—certain roads, certain woods.');
    if(age === 12){
      storyOnce('age12', 'You step into your teen years. People start expecting more of you.');
      log('Tip: You can register with the guild now (age 12+).');
    }
    if(age === 14) storyOnce('age14', 'You learn that "capable" is both praise and invitation to danger.');
    if(age === 16) storyOnce('age16', 'Adulthood arrives early in a world like this. Travel opens.');
    if(age === 60) storyOnce('age60', 'Your body slows. Wisdom grows. The end becomes visible.');
  }

  function ageUpIfNeeded(){
    while(state.stageRemainingMins <= 0 && state.alive){
      if(state.stageIndex === 0 && state.age < 12) state.age += 1;
      else if(state.stageIndex === 1 && state.age < ADULT_AGE) state.age += 1;
      else if(state.stageIndex === 2 && state.age < 60) state.age += 2;
      else state.age += 2;

      if(state.age >= 12 && state.stageIndex < 1) state.stageIndex = 1;
      if(state.age >= ADULT_AGE && state.stageIndex < 2) state.stageIndex = 2;
      if(state.age >= 60 && state.stageIndex < 3) state.stageIndex = 3;

      const cfg = stageConfig(state.stageIndex);
      state.stage = cfg.name;
      state.stageRemainingMins += cfg.daysPerStep*24*60;

      if(state.flags.landGrantPendingInvite && !world.story.landGrantEverUnlocked){
        grantLandAndUnlockTown();
      }

      if(state.stageIndex >= 2){
        if(state.rentFree){
          log('Your land grant waives rent this life.');
        } else {
          const rent = (state.stageIndex === 2) ? 50 : 80;
          if(!state.homeLocked){
            if(state.gold >= rent){
              state.gold -= rent;
              log(`You pay ${rent} gold to keep living at home.`);
            } else {
              state.homeLocked = true;
              storyOnce('kicked_out', 'You learn the quiet brutality of bills: nothing personal, just final.');
              log('You cannot afford rent. You are kicked out and lose access to Home.');
              log('Tip: Earn gold and use "Rent a Room" in Town to restore access.');
            }
          }
        }
      }

      log(`You age up. Now age ${state.age} (${state.stage}).`);
      storyBeatOnAge(state.age);

      state.energyMax = clamp(state.energyMax + 1, 80, 140);
      state.healthMax = clamp(state.healthMax + 1, 80, 160);
      state.energy = clamp(state.energy + 5, 0, state.energyMax);
      state.health = clamp(state.health + 3, 0, state.healthMax);

      if(state.stage === 'Elder'){
        const oldRisk = naturalOldAgeRisk(state);
        if(Math.random() < oldRisk){
          die('Old age (natural causes).');
          break;
        }
      }
    }
  }

  // ---------------------------
  // Death & Restart
  // ---------------------------
  function die(reason){
    state.alive = false;
    state.causeOfDeath = reason;

    const earned = computeMetaBreakdown(state);
    metaPoints += earned.total;
    setMeta(metaPoints);

    localStorage.removeItem(STORAGE_KEY);
    showSummaryModal(earned);
  }

  function showSummaryModal(earnedMeta){
    $('modalTitle').textContent = 'You Died';
    const s = state;
    const famBg = FAMILIES.find(f=>f.id===s.familyId)?.name || 'Unknown';
    const cls = CLASSES.find(c=>c.id===s.classId)?.name || 'Unassigned';

    const invCount = Object.entries(s.inventory||{}).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const invHtml = invCount.length
      ? `<div class="mono" style="margin-top:6px; line-height:1.7">${invCount.map(([id,q])=>escapeHtml(invLine(id,q))).join('<br>')}</div>`
      : `<div class="small" style="margin-top:6px">(No items)</div>`;

    const breakdown = earnedMeta?.parts || [];
    const breakdownHtml = breakdown.length ? `
      <div class="mono" style="margin-top:6px; line-height:1.75">
        ${breakdown.map(p=>`${escapeHtml(p.label)}: +${p.value} <span class=\"small\">${escapeHtml(p.detail||'')}</span>`).join('<br>')}
      </div>
    ` : `<div class="small" style="margin-top:6px">(No breakdown)</div>`;

    const currentTown = getTownById(s.currentTownId);
    const ownedTown = s.ownedTownId ? getTownById(s.ownedTownId) : null;

    $('modalBody').innerHTML = `
      <div class="tag bad">Cause</div> <span class="hl">${escapeHtml(s.causeOfDeath||'Unknown')}</span>
      <div style="margin-top:10px" class="split">
        <div>
          <div class="tag">Identity</div>
          <div class="mono" style="margin-top:6px">${escapeHtml(s.name)} (${escapeHtml(displayGender(s))}), age ${s.age}</div>
          <div class="small">Family name: ${escapeHtml(s.familyName)} · Origin: ${escapeHtml(famBg)} · Class: ${escapeHtml(cls)}</div>
          <div class="small">Town: ${escapeHtml(townLabel(currentTown))}</div>
          <div class="small">Gear: ${escapeHtml(gearLabel(s.gear.weaponId))} · ${escapeHtml(gearLabel(s.gear.armorId))}</div>
          <div class="small">Owned town: ${ownedTown ? escapeHtml(townLabel(ownedTown)) : 'None'}</div>
        </div>
        <div>
          <div class="tag good">Meta Points Earned</div>
          <div class="mono" style="margin-top:6px; font-size:20px">+${earnedMeta.total}</div>
          <div class="small">Total meta points: ${metaPoints}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="tag">Meta breakdown</div>${breakdownHtml}
      <div class="divider"></div>
      <div class="tag">Stats</div>
      <div class="mono" style="margin-top:6px; line-height:1.7">
        INT ${s.intelligence} · STR ${s.strength} · MAG ${s.magic} · CHA ${s.charm} · LUCK ${s.luck}<br>
        Energy ${s.energy}/${s.energyMax} · Health ${s.health}/${s.healthMax} · Gold ${s.gold}<br>
        Guild: ${s.guild.registered ? 'Registered' : 'Not registered'} · Rank ${s.guild.rank} · Quests ${s.guild.questsCompleted}
      </div>
      <div class="divider"></div>
      <div class="tag">Inventory (top)</div>${invHtml}
      <div class="divider"></div>
      <div class="small">Reincarnate to spend meta points. Your kingdom progress persists (unlocked towns + built facilities).</div>
    `;

    $('modalOverlay').style.display = 'flex';
  }

  function closeModal(){ $('modalOverlay').style.display = 'none'; }

  // ---------------------------
  // Save/Load
  // ---------------------------
  function saveGame(){
    if(!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, world, metaPoints }));
    log('Game saved.');
  }

  function loadGame(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    try{ return JSON.parse(raw); } catch { return null; }
  }

  // ---------------------------
  // Actions per location (town-aware)
  // ---------------------------
  function getActionsForLocation(locationId, townId){
    if(locationId === 'guild'){
      const base = ACTIONS.guild.slice();
      return base.concat(actionsApi.getGuildQuestsForTown(townId));
    }

    if(locationId === 'town'){
      const base = ACTIONS.town.slice();
      return base.concat(actionsApi.getBlacksmithActionsForTown(townId));
    }

    return (ACTIONS[locationId]||[]).slice();
  }

  // ---------------------------
  // Rendering
  // ---------------------------
  function renderTopKpi(){
    $('topKpi').innerHTML = `
      <span class="pill"><span class="mono">Meta</span> <b class="mono">${metaPoints}</b></span>
      <span class="pill"><span class="mono">World</span> <b class="mono">${visibleTownsIncludingOwnedUnnamed().length}</b></span>
      <span class="pill"><span class="mono">Today</span> <b class="mono">${new Date().toLocaleDateString()}</b></span>
    `;
  }

  function calcSpend(){
    const i = clamp(parseInt($('spInt').value||'0',10),0,999);
    const s = clamp(parseInt($('spStr').value||'0',10),0,999);
    const m = clamp(parseInt($('spMag').value||'0',10),0,999);
    const c = clamp(parseInt($('spCha').value||'0',10),0,999);
    const l = clamp(parseInt($('spLuck').value||'0',10),0,999);
    const g = clamp(parseInt($('spGold').value||'0',10),0,999999);
    const gCost = Math.floor(g/10);
    return { int:i, str:s, mag:m, cha:c, luck:l, gold:g, totalCost: i+s+m+c+l+gCost };
  }

  function renderLanding(){
    $('metaPoints').textContent = metaPoints;
    if($('selFamily').options.length === 0){
      for(const f of FAMILIES){
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        $('selFamily').appendChild(opt);
      }
    }
    const fam = FAMILIES.find(f=>f.id===$('selFamily').value) || FAMILIES[0];
    $('familyDesc').textContent = fam.desc;

    const spent = calcSpend();
    const remain = metaPoints - spent.totalCost;
    $('spendStatus').innerHTML = remain >= 0
      ? `You are spending <span class="hl mono">${spent.totalCost}</span> points. Remaining: <span class="hl mono">${remain}</span>.`
      : `You are overspending by <span class="hl mono">${-remain}</span> points.`;
    $('btnStart').disabled = remain < 0;
  }

  function renderInventory(){
    const entries = Object.entries(state.inventory||{}).sort((a,b)=>b[1]-a[1]);
    if(entries.length === 0){
      $('invList').innerHTML = '<span class="small">(Empty)</span>';
      return;
    }
    const top = entries.slice(0, 12);
    $('invList').innerHTML = `<div class="mono" style="line-height:1.7">${top.map(([id,q])=>escapeHtml(invLine(id,q))).join('<br>')}</div>`;
  }

  function renderQueue(){
    const q = state.queue;
    if(!q || q.length === 0){
      $('queueList').innerHTML = '<div class="small">(No queued actions)</div>';
      $('btnClearQueue').disabled = true;
      return;
    }
    $('btnClearQueue').disabled = false;
    $('queueList').innerHTML = q.map((it, idx)=>{
      const name = actionName(it.locId, it.actionId, state.currentTownId);
      return `
        <div class="queueItem">
          <div class="small"><span class="hl">${escapeHtml(name)}</span> <span class="mono">(${escapeHtml(it.locId)})</span></div>
          <button class="secondary" data-qrm="${idx}">Remove</button>
        </div>
      `;
    }).join('');
  }

  function renderActionCard(a, locId){
    if(!a.alwaysVisible && typeof a.minAge === 'number' && state.age < a.minAge) return '';

    const r = a.requirements ? a.requirements(state) : req(true);

    let timeCost = a.timeCostMins || 0;
    if(a.special === 'travel') timeCost = getPlannedTravelCost();
    const hasTime = state.stageRemainingMins >= timeCost;

    let deathInfo = '';
    if(a.adventure){
      const chance = computeAdventureDeathChance(state, a.adventure.baseRisk);
      const tagClass = chance < 0.06 ? 'good' : (chance < 0.14 ? 'warn' : 'bad');
      deathInfo = ` <span class="tag ${tagClass}">Death ${(chance*100).toFixed(1)}%</span>`;
    }

    const qFull = queueSize() >= 10;
    const homeLocked = (locId==='home' && state.homeLocked);
    const disabled = homeLocked || !r.ok || !hasTime || (state.task.running && qFull);

    let reqText = 'Ready.';
    if(homeLocked) reqText = 'Home is locked.';
    else if(!hasTime) reqText = `Not enough stage time (need ${fmtTime(timeCost)}).`;
    else if(!r.ok) reqText = r.why;
    else if(state.task.running && !qFull) reqText = 'Will enqueue while your current task runs.';
    else if(state.task.running && qFull) reqText = 'Queue is full.';

    const parts = [];
    if(timeCost) parts.push(`Time: ${fmtTime(timeCost)}`);
    if(a.durationSec) parts.push(`Real: ${a.durationSec}s`);
    if(a.energyCost) parts.push(`Energy: -${a.energyCost}`);
    if(a.energyGain) parts.push(`Energy: +${a.energyGain}`);
    if(a.rewards){
      if(typeof a.rewards.health === 'number') parts.push(`Health: ${a.rewards.health>=0?'+':''}${a.rewards.health}`);
      if(typeof a.rewards.gold === 'number') parts.push(`Gold: ${a.rewards.gold>=0?'+':''}${a.rewards.gold}`);
      if(typeof a.rewards.guildXP === 'number') parts.push(`Guild XP: +${a.rewards.guildXP}`);
    }
    if(a.statGains){
      const sg = Object.entries(a.statGains).map(([k,v])=>`${k.toUpperCase().slice(0,3)} +${v}`).join(', ');
      if(sg) parts.push(sg);
    }

    const queueAllowed = !!a.queueable && locId === 'home';
    const btnQDisabled = homeLocked || !r.ok || !hasTime || qFull;

    const mainLabel = disabled
      ? 'Unavailable'
      : (state.task.running ? 'Queue' : 'Do it');

    return `
      <div class="action">
        <div class="title">
          <b>${escapeHtml(a.name)}</b>
          <div>${deathInfo}</div>
        </div>
        <div class="meta">${escapeHtml(a.meta||'')}</div>
        <div class="small">${escapeHtml(parts.join(' · '))}</div>
        <div class="req">Status: <span class="hl">${escapeHtml(reqText)}</span></div>
        <div style="margin-top:auto">
          <div class="btnRow">
            <button ${disabled?'disabled':''} data-action="${a.id}" data-loc="${locId}" data-mode="do">${mainLabel}</button>
            ${queueAllowed ? `
              <button class="secondary" ${btnQDisabled?'disabled':''} data-action="${a.id}" data-loc="${locId}" data-mode="q" data-q="5">x5</button>
              <button class="secondary" ${btnQDisabled?'disabled':''} data-action="${a.id}" data-loc="${locId}" data-mode="q" data-q="10">x10</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderGame(){
    const className = CLASSES.find(c=>c.id===state.classId)?.name || 'Unassigned';
    const weaponName = gearLabel(state.gear?.weaponId || 'none');
    const armorName = gearLabel(state.gear?.armorId || 'none');

    const t = getTownById(state.currentTownId);
    const ownedTown = state.ownedTownId ? getTownById(state.ownedTownId) : null;

    $('worldLine').innerHTML = `Current town: <span class="hl mono">${escapeHtml(townLabel(t))}</span> · Owned town: <span class="hl mono">${escapeHtml(ownedTown ? townLabel(ownedTown) : 'None')}</span>`;

    $('charKpi').innerHTML = `
      <span class="pill"><span class="mono">Name</span> <b class="mono">${escapeHtml(state.name)}</b></span>
      <span class="pill"><span class="mono">Gender</span> <b class="mono">${escapeHtml(displayGender(state))}</b></span>
      <span class="pill"><span class="mono">Age</span> <b class="mono">${state.age}</b></span>
      <span class="pill"><span class="mono">Stage</span> <b class="mono">${escapeHtml(state.stage)}</b></span>
      <span class="pill"><span class="mono">Family</span> <b class="mono">${escapeHtml(state.familyName)}</b></span>
      <span class="pill"><span class="mono">Class</span> <b class="mono">${escapeHtml(className)}</b></span>
      <span class="pill"><span class="mono">Weapon</span> <b class="mono">${escapeHtml(weaponName)}</b></span>
      <span class="pill"><span class="mono">Armor</span> <b class="mono">${escapeHtml(armorName)}</b></span>
      <span class="pill"><span class="mono">Gold</span> <b class="mono">${state.gold}</b></span>
      <span class="pill"><span class="mono">Guild</span> <b class="mono">${state.guild.registered ? `Rank ${state.guild.rank}` : 'Not registered'}</b></span>
      <span class="pill"><span class="mono">Meta</span> <b class="mono">${metaPoints}</b></span>
    `;

    const stats = [
      {k:'intelligence', label:'Intelligence'},
      {k:'strength', label:'Strength'},
      {k:'magic', label:'Magic'},
      {k:'charm', label:'Charm'},
      {k:'luck', label:'Luck'},
      {k:'energy', label:`Energy / ${state.energyMax}`},
      {k:'health', label:`Health / ${state.healthMax}`},
    ];
    $('statGrid').innerHTML = stats.map(s=>{
      const val = (s.k==='energy') ? `${state.energy}` : (s.k==='health') ? `${state.health}` : `${state[s.k]}`;
      return `<div class="stat"><div class="label">${escapeHtml(s.label)}</div><div class="value mono">${escapeHtml(val)}</div></div>`;
    }).join('');

    renderInventory();

    $('timeLine').innerHTML = `Stage time remaining: <span class="hl mono">${fmtTime(state.stageRemainingMins)}</span> / <span class="mono">${fmtTime(state.stageTotalMins)}</span>`;
    const pct = 100 * (1 - (state.stageRemainingMins / Math.max(1, state.stageTotalMins)));
    $('timeBar').style.width = `${clamp(pct,0,100)}%`;

    if(state.task.running){
      const elapsed = Date.now() - state.task.startedAt;
      const tPct = 100 * (elapsed / Math.max(1,state.task.durationMs));
      $('taskLine').innerHTML = `Running: <span class="hl">${escapeHtml(state.task.actionName)}</span>`;
      $('taskBar').style.width = `${clamp(tPct,0,100)}%`;
    } else {
      $('taskLine').textContent = 'No task running.';
      $('taskBar').style.width = '0%';
    }

    const locs = locationsForTown(state.currentTownId);
    $('mapTabs').innerHTML = locs.map(l=>{
      const active = l.id===state.currentLocationId ? 'active' : '';
      return `<div class="tab ${active}" data-loc="${l.id}">${escapeHtml(l.name)}</div>`;
    }).join('');

    const loc = locs.find(l=>l.id===state.currentLocationId) || locs[0];

    let extraPanel = '';
    if(loc.id === 'travel'){
      const towns = visibleTownsIncludingOwnedUnnamed();
      extraPanel = `
        <div class="note small">
          <div><span class="tag">Travel</span> Available at age <b>${ADULT_AGE}+</b>.</div>
          <div style="margin-top:6px">Select destination:</div>
          <select id="selTravelTo" style="margin-top:6px">
            ${towns.map(tt=>`<option value="${tt.id}" ${tt.id===state.currentTownId?'selected':''}>${escapeHtml(townLabel(tt))}</option>`).join('')}
          </select>
          <div class="small" style="margin-top:6px">Travel time cost: <span class="hl mono">${fmtTime(getPlannedTravelCost()||0)}</span> · Real time: <span class="mono">10s</span></div>
          <div class="small" style="margin-top:6px">Queued actions that do not exist in the destination town will be removed automatically.</div>
        </div>
        <div class="divider"></div>
      `;
    }

    if(loc.id === 'development'){
      const ot = state.ownedTownId ? getTownById(state.ownedTownId) : null;
      if(ot){
        extraPanel = `
          <div class="note small">
            <div><span class="tag good">Your Domain</span> Build facilities to permanently improve this town across future lives.</div>
            <div style="margin-top:6px">Facilities: 
              <span class="tag ${ot.facilities.blacksmith?'good':'warn'}">Blacksmith: ${ot.facilities.blacksmith?'Built':'Missing'}</span>
              <span class="tag ${ot.facilities.store?'good':'warn'}">Store: ${ot.facilities.store?'Built':'Missing'}</span>
              <span class="tag ${ot.facilities.infrastructure?'good':'warn'}">Infrastructure: ${ot.facilities.infrastructure?'Built':'Missing'}</span>
            </div>
            <div class="small" style="margin-top:6px">Costs: Blacksmith 400g · Store 300g · Infrastructure 700g</div>
          </div>
          <div class="divider"></div>
        `;
      }
    }

    const actions = getActionsForLocation(loc.id, state.currentTownId);

    const homeLockNote = (loc.id==='home' && state.homeLocked)
      ? `<div class="note small"><span class="tag bad">Locked</span> You do not currently have a home. Earn gold, then rent a room in Town.</div><div class="divider"></div>`
      : '';

    $('locationPanel').innerHTML = `
      <div class="row" style="align-items:flex-start; justify-content:space-between">
        <div>
          <div style="font-size:14px; margin-bottom:4px"><b>${escapeHtml(loc.name)}</b></div>
          <div class="small">${escapeHtml(loc.desc)}</div>
          <div class="small" style="margin-top:6px">Town: <span class="hl mono">${escapeHtml(townLabel(t))}</span></div>
        </div>
        <div>
          ${state.buffs.supplies > 0 ? '<span class="tag good">Supplies: safer next adventure</span>' : '<span class="tag">No active buffs</span>'}
          <span class="tag">Queue ${queueSize()}/10</span>
        </div>
      </div>
      <div class="divider"></div>
      ${extraPanel}
      ${homeLockNote}
      <div class="actions">
        ${actions.map(a=>renderActionCard(a, loc.id)).join('') || '<div class="small">(No actions available yet.)</div>'}
      </div>
    `;

    $('log').innerHTML = state.log.map(e=>{
      return `<div class="entry"><div class="t">${escapeHtml(e.t)}</div><div>${escapeHtml(e.msg)}</div></div>`;
    }).join('');

    renderQueue();

    $('btnSave').disabled = state.task.running;
    $('btnAbandon').disabled = state.task.running;
    $('btnAgeUp').disabled = state.task.running;
  }

  function render(){
    renderTopKpi();
    if(state){
      $('screenLanding').style.display = 'none';
      $('screenGame').style.display = 'grid';
      renderGame();
    } else {
      $('screenLanding').style.display = 'grid';
      $('screenGame').style.display = 'none';
      renderLanding();
    }
  }

  // ---------------------------
  // Start Life
  // ---------------------------
  function beginLife(){
    const spent = calcSpend();
    const remaining = metaPoints - spent.totalCost;
    if(remaining < 0) return;

    metaPoints = remaining;
    setMeta(metaPoints);

    state = freshState();
    state.name = ($('inpName').value || 'Alex').trim().slice(0,20) || 'Alex';
    state.gender = $('selGender').value;
    state.familyId = $('selFamily').value;

    const fn = ($('inpFamilyName').value || '').trim().slice(0,18);
    state.familyName = fn || generateFamilyName();

    const startTown = randomFrom(world.towns.filter(t=>t.unlocked && t.name));
    state.currentTownId = startTown.id;
    state.currentLocationId = 'home';

    const fam = FAMILIES.find(f=>f.id===state.familyId) || FAMILIES[0];
    for(const [k,v] of Object.entries(fam.mods)){
      if(k==='gold') state.gold += v;
      else if(k==='energyMax') state.energyMax += v;
      else if(k==='healthMax') state.healthMax += v;
      else state[k] = (state[k]||0) + v;
    }

    state.intelligence += spent.int;
    state.strength += spent.str;
    state.magic += spent.mag;
    state.charm += spent.cha;
    state.luck += spent.luck;
    state.gold += spent.gold;

    state.energy = clamp(state.energy, 0, state.energyMax);
    state.health = clamp(state.health, 0, state.healthMax);

    ensureStageTime(state);

    state.log = [];
    log(`You begin a new life at age ${state.age}.`);
    log(`Family name: ${state.familyName}. Origin: ${fam.name}.`);
    log(`You are born in ${townLabel(startTown)}.`);
    storyOnce('life_start', 'A familiar feeling you cannot name—like waking from a dream you already lived.');
    log('Tip: Queue Home actions with x5/x10 to reduce clicking.');

    localStorage.removeItem(STORAGE_KEY);
    render();
  }

  // ---------------------------
  // Wiring
  // ---------------------------
  function wireLanding(){
    ['spInt','spStr','spMag','spCha','spLuck','spGold','selFamily'].forEach(id=>{
      $(id).addEventListener('input', renderLanding);
      $(id).addEventListener('change', renderLanding);
    });

    $('btnStart').addEventListener('click', beginLife);

    $('btnResetMeta').addEventListener('click', ()=>{
      setMeta(0);
      metaPoints = 0;
      world = freshWorld();
      saveWorld();
      localStorage.removeItem(STORAGE_KEY);
      render();
    });
  }

  function wireGame(){
    $('mapTabs').addEventListener('click', (e)=>{
      const t = e.target.closest('[data-loc]');
      if(!t) return;
      state.currentLocationId = t.getAttribute('data-loc');
      render();
    });

    $('locationPanel').addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;

      const actionId = btn.getAttribute('data-action');
      const locId = btn.getAttribute('data-loc');
      const mode = btn.getAttribute('data-mode') || 'do';
      const action = getActionsForLocation(locId, state.currentTownId).find(a=>a.id===actionId);
      if(!action) return;
      const queueAllowed = !!action.queueable && locId === 'home';

      if(mode === 'q'){
        if(!queueAllowed){
          log('This action cannot be queued.');
          return;
        }
        const n = parseInt(btn.getAttribute('data-q')||'1',10);
        enqueueAction(locId, actionId, n);
        return;
      }

      if(state.task.running){
        if(queueAllowed){
          enqueueAction(locId, actionId, 1);
        } else {
          log('Finish the current task before starting this action.');
        }
        return;
      }

      startTask(action, locId);
    });

    $('queueList').addEventListener('click', (e)=>{
      const rm = e.target.closest('button[data-qrm]');
      if(!rm) return;
      const idx = parseInt(rm.getAttribute('data-qrm'),10);
      if(Number.isFinite(idx)) removeQueueIndex(idx);
    });

    $('btnClearQueue').addEventListener('click', ()=>{ if(!state.task.running) clearQueue(); });

    $('btnAgeUp').addEventListener('click', ()=>{
      if(state.task.running) return;
      state.stageRemainingMins = 0;
      log('You skip ahead. (Less time means fewer gains.)');
      ageUpIfNeeded();
      render();
      maybeStartNextFromQueue();
    });

    $('btnSave').addEventListener('click', saveGame);

    function downloadSaveFile(){
      if(!state) return;
      const snapshot = { state, world, metaPoints };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,19).replaceAll(':','-');
      a.href = URL.createObjectURL(blob);
      a.download = `life-loop-save-v4-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }

    function loadFromObject(obj){
      if(!obj) return;
      if(obj.state && obj.world){
        state = obj.state;
        world = obj.world;
        metaPoints = (typeof obj.metaPoints === 'number') ? obj.metaPoints : defaultMeta();
        setMeta(metaPoints);
        saveWorld();
      } else {
        alert('This save file is not compatible with v4.');
        return;
      }

      state.inventory = state.inventory || {};
      state.queue = state.queue || [];
      state.flags = state.flags || {};
      state.buffs = state.buffs || { supplies: 0 };
      state.guild = state.guild || { registered:false, rank:'F', xp:0, questsCompleted:0 };
      state.gear = state.gear || { weaponId:'none', armorId:'none' };
      state.task = { running:false, actionId:null, actionName:null, startedAt:0, durationMs:0, locationId:null, townId:null };
      if(!state.currentTownId){
        const startTown = randomFrom(world.towns.filter(t=>t.unlocked && t.name));
        state.currentTownId = startTown.id;
      }
      state.currentLocationId = state.currentLocationId || 'home';
      ensureStageTime(state);

      log('Save loaded.');
      render();
      maybeStartNextFromQueue();
    }

    $('btnDownload').addEventListener('click', ()=>{
      saveGame();
      downloadSaveFile();
      log('Save exported.');
    });

    $('btnLoad').addEventListener('click', ()=>{
      const inp = $('fileLoad');
      if(inp) inp.click();
    });

    $('fileLoad').addEventListener('change', async (e)=>{
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if(!file) return;
      try{
        const text = await file.text();
        const obj = JSON.parse(text);
        loadFromObject(obj);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, world, metaPoints }));
      } catch{
        alert('Could not load save file. Make sure it is a valid JSON save from this game.');
      }
    });

    $('btnAbandon').addEventListener('click', ()=>{
      if(state.task.running) return;
      die('Gave up on the life.');
    });
  }

  function wireModal(){
    $('btnRestart').addEventListener('click', ()=>{
      closeModal();
      state = null;
      ['spInt','spStr','spMag','spCha','spLuck','spGold'].forEach(id=>$(id).value = 0);
      render();
    });
    $('btnCloseModal').addEventListener('click', closeModal);
    $('modalOverlay').addEventListener('click', (e)=>{
      if(e.target === $('modalOverlay')) closeModal();
    });
  }

  // ---------------------------
  // Minimal Tests (console)
  // ---------------------------
  function runDomTests(){
    const required = [
      'screenLanding','screenGame','btnStart','btnResetMeta','selFamily','selGender','inpFamilyName',
      'mapTabs','locationPanel','queueList','btnClearQueue','btnAgeUp',
      'btnSave','btnDownload','btnLoad','fileLoad','btnAbandon',
      'modalOverlay','btnRestart','btnCloseModal'
    ];
    const missing = required.filter(id=>!$(id));
    if(missing.length){
      console.error('DOM TEST FAIL: missing required element ids:', missing);
    } else {
      console.log('DOM TEST PASS: all required elements present.');
    }

    // Template literal / parsing sanity test: ensure this line executes.
    try{
      const msg = `Need age ${ADULT_AGE}+.`;
      if(typeof msg !== 'string' || !msg.includes(String(ADULT_AGE))) throw new Error('Template literal failed.');
      console.log('JS TEST PASS: template literals OK.');
    } catch (err){
      console.error('JS TEST FAIL: template literal parsing issue:', err);
    }
  }

  // ---------------------------
  // Boot
  // ---------------------------
  function boot(){
    $('selFamily').value = FAMILIES[0].id;
    $('inpName').value = 'Alex';
    $('inpFamilyName').value = '';

    wireLanding();
    wireGame();
    wireModal();

    const saved = loadGame();
    if(saved && saved.state && saved.world){
      state = saved.state;
      world = saved.world;
      metaPoints = (typeof saved.metaPoints === 'number') ? saved.metaPoints : defaultMeta();
      setMeta(metaPoints);
      saveWorld();

      state.inventory = state.inventory || {};
      state.queue = state.queue || [];
      state.flags = state.flags || {};
      state.buffs = state.buffs || { supplies: 0 };
      state.guild = state.guild || { registered:false, rank:'F', xp:0, questsCompleted:0 };
      state.gear = state.gear || { weaponId:'none', armorId:'none' };
      state.task = { running:false, actionId:null, actionName:null, startedAt:0, durationMs:0, locationId:null, townId:null };
      if(!state.currentTownId){
        const startTown = randomFrom(world.towns.filter(t=>t.unlocked && t.name));
        state.currentTownId = startTown.id;
      }
      state.currentLocationId = state.currentLocationId || 'home';
      ensureStageTime(state);
    } else {
      state = null;
      metaPoints = defaultMeta();
      world = loadWorld();
    }

    if(state && state.task && state.task.running){
      state.task.running = false;
      log('A previous task was interrupted (reload). Task cancelled.');
    }

    $('selFamily').addEventListener('change', ()=>{
      const fam = FAMILIES.find(f=>f.id===$('selFamily').value) || FAMILIES[0];
      $('familyDesc').textContent = fam.desc;
    });

    render();
    runDomTests();
  }

  boot();
})();
