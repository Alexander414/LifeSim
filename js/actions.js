import { ADULT_AGE, GUILD_MIN_AGE } from './constants.js';

export function createActionsApi(deps){
  const { req, rankIndex, getTownById, saveWorld, removeItem } = deps;

  function buildActions(){
    return {
      home: [
        {
          id:'read', name:'Read a Book',
          meta:'Study quietly. Great for Intelligence. Small Magic insight.',
          minAge: 7,
          timeCostMins: 120, durationSec: 5, energyCost: 8,
          statGains:{ intelligence: 5, magic: 1 }, rewards:{},
          requirements:(s)=> s.energy >= 8 ? req(true) : req(false,'Not enough Energy.'),
          queueable:true,
        },
        {
          id:'meditate', name:'Meditate',
          meta:'Calms the mind. Improves Magic control and Luck slightly.',
          minAge: 7,
          timeCostMins: 60, durationSec: 5, energyCost: 5,
          statGains:{ magic: 4, luck: 1 }, rewards:{},
          requirements:(s)=> s.energy >= 5 ? req(true) : req(false,'Not enough Energy.'),
          queueable:true,
        },
        {
          id:'train', name:'Body Training',
          meta:'Build Strength and Health. Costs more Energy.',
          minAge: 7,
          timeCostMins: 90, durationSec: 5, energyCost: 12,
          statGains:{ strength: 4 }, rewards:{ health: +3 },
          requirements:(s)=> s.energy >= 12 ? req(true) : req(false,'Not enough Energy.'),
          queueable:true,
        },
        {
          id:'sleep', name:'Sleep',
          meta:'Restore Energy and Health. Consumes time.',
          minAge: 7,
          timeCostMins: 480, durationSec: 5, energyGain: 40,
          rewards:{ health: +20 }, statGains:{}, requirements:(s)=> req(true), queueable:true,
        },
        {
          id:'nap', name:'Nap',
          meta:'Short rest. Useful when you do not have time for full sleep.',
          minAge: 7,
          timeCostMins: 120, durationSec: 5, energyGain: 18,
          rewards:{ health: +6 }, statGains:{}, requirements:(s)=> req(true), queueable:true,
        },
      ],

      town: [
        {
          id:'oddjob', name:'Do an Odd Job',
          meta:'Small income. Improves Charm through interactions.',
          minAge: 9,
          timeCostMins: 180, durationSec: 5, energyCost: 10,
          statGains:{ charm: 2 }, rewards:{ gold: 18 },
          requirements:(s)=> s.energy >= 10 ? req(true) : req(false,'Not enough Energy.'),
        },
        {
          id:'shopSupplies', name:'Buy Supplies',
          meta:'Spend gold to reduce death chance slightly on next adventure.',
          minAge: 12,
          timeCostMins: 30, durationSec: 5, energyCost: 2,
          statGains:{}, rewards:{ gold: -20 },
          requirements:(s)=> s.gold >= 20 ? req(true) : req(false,'Need at least 20 gold.')
        },
        {
          id:'listenRumors', name:'Listen for Rumors',
          meta:'Sometimes hints at better work or safer paths. Improves Luck.',
          minAge: 9,
          timeCostMins: 60, durationSec: 5, energyCost: 4,
          statGains:{ luck: 2 }, rewards:{},
          requirements:(s)=> s.energy >= 4 ? req(true) : req(false,'Not enough Energy.')
        },
        {
          id:'chooseClass', name:'Choose a Class',
          meta:'At age 12+, commit to a path. Auto-picks based on your stats for now.',
          minAge: 12,
          timeCostMins: 30, durationSec: 5, energyCost: 2,
          statGains:{}, rewards:{},
          requirements:(s)=>{
            if(s.age < 12) return req(false,'Available at age 12+.');
            if(s.classId !== 'none') return req(false,'Class already chosen.');
            if(s.energy < 2) return req(false,'Not enough Energy.');
            return req(true);
          },
          onComplete:(s)=>{
            const scoreMage = s.magic*1.2 + s.intelligence*0.8;
            const scoreAdv = s.strength*1.0 + s.magic*0.8 + (s.guild.registered?8:0);
            const scoreGath = s.luck*1.0 + s.intelligence*0.6;
            const scoreTamer = s.luck*1.1 + s.charm*0.8;
            const best = [
              {id:'mage', v:scoreMage},
              {id:'adventurer', v:scoreAdv},
              {id:'gatherer', v:scoreGath},
              {id:'tamer', v:scoreTamer},
            ].sort((a,b)=>b.v-a.v)[0].id;
            s.classId = best;
          }
        },
        {
          id:'rentRoom', name:'Rent a Room (Restore Home Access)',
          meta:'If you were kicked out, pay to regain access to Home actions.',
          minAge: ADULT_AGE,
          timeCostMins: 30, durationSec: 5, energyCost: 2,
          statGains:{}, rewards:{},
          requirements:(s)=>{
            if(!s.homeLocked) return req(false,'Home is already available.');
            if(s.gold < 80) return req(false,'Need 80 gold.');
            if(s.energy < 2) return req(false,'Not enough Energy.');
            return req(true);
          },
          onComplete:(s)=>{ s.gold -= 80; s.homeLocked = false; }
        },
      ],

      guild: [
        {
          id:'register', name:'Register with the Guild',
          meta:`Your parents will not allow it until age ${GUILD_MIN_AGE}. Starting rank depends on your stats.`,
          alwaysVisible:true,
          minAge: 7,
          timeCostMins: 60, durationSec: 5, energyCost: 4,
          statGains:{}, rewards:{},
          requirements:(s)=>{
            if(s.guild.registered) return req(false,'Already registered.');
            if(s.age < GUILD_MIN_AGE) return req(false,`Too young (need age ${GUILD_MIN_AGE}+).`);
            return req(true);
          }
        },
      ],

      forest: [
        {
          id:'gatherHerbs', name:'Gather Herbs',
          meta:'Low risk. Earns a little gold and improves Luck. Adds herbs to inventory.',
          minAge: 10,
          timeCostMins: 240, durationSec: 15, energyCost: 16,
          statGains:{ luck: 2 }, rewards:{ gold: 25 },
          requirements:(s)=> s.energy >= 16 ? req(true) : req(false,'Not enough Energy.'),
          adventure:{ baseRisk: 0.04, kind:'field', loot:[{id:'herb', min:1, max:3}], travelLike:true }
        },
        {
          id:'huntBoar', name:'Hunt a Wild Boar',
          meta:'Risky. Improves Strength and grants more gold. Adds meat/hide.',
          minAge: 12,
          timeCostMins: 360, durationSec: 15, energyCost: 24,
          statGains:{ strength: 3 }, rewards:{ gold: 55 },
          requirements:(s)=>{
            if(s.energy < 24) return req(false,'Not enough Energy.');
            if(s.age < 12) return req(false,'Too young (need age 12+).');
            return req(true);
          },
          adventure:{ baseRisk: 0.10, kind:'field', loot:[{id:'boar_meat', min:1, max:3},{id:'boar_hide', min:0, max:1}], travelLike:true }
        },
        {
          id:'huntWolf', name:'Hunt a Lone Wolf',
          meta:'High risk. Strong loot. Recommended after age 12 and/or with gear.',
          minAge: 14,
          timeCostMins: 420, durationSec: 15, energyCost: 26,
          statGains:{ strength: 2, luck:1 }, rewards:{ gold: 70 },
          requirements:(s)=>{
            if(s.energy < 26) return req(false,'Not enough Energy.');
            if(s.age < 14) return req(false,'Too young (need age 14+).');
            return req(true);
          },
          adventure:{ baseRisk: 0.16, kind:'field', loot:[{id:'wolf_meat', min:1, max:2},{id:'wolf_fang', min:1, max:2},{id:'wolf_hide', min:0, max:1}], travelLike:true }
        },
      ],

      mine: [
        {
          id:'mineOre', name:'Mine Ore',
          meta:'Moderate risk. Earns gold. Adds ore to inventory (copper/iron).',
          minAge: 12,
          timeCostMins: 360, durationSec: 15, energyCost: 22,
          statGains:{ strength:1 }, rewards:{ gold: 65 },
          requirements:(s)=>{
            if(s.energy < 22) return req(false,'Not enough Energy.');
            if(s.age < 12) return req(false,'Too young (need age 12+).');
            return req(true);
          },
          adventure:{ baseRisk: 0.11, kind:'field', loot:[{id:'stone', min:1, max:3},{id:'copper', min:0, max:2},{id:'iron', min:0, max:1}], travelLike:true }
        },
      ],

      travel: [
        {
          id:'travelToTown', name:'Travel to another town',
          meta:'Travel is only possible once you are 16+. Travel takes 10 real seconds and consumes stage time depending on distance.',
          minAge: ADULT_AGE,
          timeCostMins: 0, durationSec: 10, energyCost: 10,
          statGains:{}, rewards:{},
          requirements:(s)=>{
            if(s.age < ADULT_AGE) return req(false,`Need age ${ADULT_AGE}+.`);
            if(s.energy < 10) return req(false,'Not enough Energy.');
            return req(true);
          },
          special:'travel'
        }
      ],

      development: [
        {
          id:'buildBlacksmith', name:'Build: Blacksmith',
          meta:'Adds blacksmith services to your town permanently.',
          minAge: ADULT_AGE,
          timeCostMins: 240, durationSec: 10, energyCost: 12,
          requirements:(s)=>{
            if(!s.ownedTownId) return req(false,'You do not own a town.');
            const t = getTownById(s.ownedTownId);
            if(!t) return req(false,'Town missing.');
            if(t.facilities.blacksmith) return req(false,'Already built.');
            if(s.gold < 400) return req(false,'Need 400 gold.');
            if(s.energy < 12) return req(false,'Not enough Energy.');
            return req(true);
          },
          onComplete:(s)=>{
            s.gold -= 400;
            const t = getTownById(s.ownedTownId);
            t.facilities.blacksmith = true;
            saveWorld();
          }
        },
        {
          id:'buildStore', name:'Build: Store',
          meta:'Adds a store that improves supply access and town quests.',
          minAge: ADULT_AGE,
          timeCostMins: 240, durationSec: 10, energyCost: 12,
          requirements:(s)=>{
            if(!s.ownedTownId) return req(false,'You do not own a town.');
            const t = getTownById(s.ownedTownId);
            if(!t) return req(false,'Town missing.');
            if(t.facilities.store) return req(false,'Already built.');
            if(s.gold < 300) return req(false,'Need 300 gold.');
            if(s.energy < 12) return req(false,'Not enough Energy.');
            return req(true);
          },
          onComplete:(s)=>{
            s.gold -= 300;
            const t = getTownById(s.ownedTownId);
            t.facilities.store = true;
            saveWorld();
          }
        },
        {
          id:'buildInfrastructure', name:'Build: Infrastructure',
          meta:'Roads, guards, and services. Unlocks better guild quests permanently.',
          minAge: ADULT_AGE,
          timeCostMins: 480, durationSec: 10, energyCost: 18,
          requirements:(s)=>{
            if(!s.ownedTownId) return req(false,'You do not own a town.');
            const t = getTownById(s.ownedTownId);
            if(!t) return req(false,'Town missing.');
            if(t.facilities.infrastructure) return req(false,'Already built.');
            if(s.gold < 700) return req(false,'Need 700 gold.');
            if(s.energy < 18) return req(false,'Not enough Energy.');
            return req(true);
          },
          onComplete:(s)=>{
            s.gold -= 700;
            const t = getTownById(s.ownedTownId);
            t.facilities.infrastructure = true;
            saveWorld();
          }
        },
      ],
    };
  }

  let ACTIONS = buildActions();

  function getGuildQuestsForTown(townId){
    const t = getTownById(townId);
    const infra = !!t?.facilities?.infrastructure;

    const base = [
      {
        id:'guildQuestEasy', name:'Guild Quest: Herb Delivery (Easy)',
        meta:'Low risk. Increases reputation and gold.',
        minAge: 12,
        timeCostMins: 360, durationSec: 15, energyCost: 18,
        statGains:{ intelligence:1, charm:1 }, rewards:{ gold: 40, guildXP: 14 },
        requirements:(s)=>{
          if(!s.guild.registered) return req(false,'Register first.');
          if(s.energy < 18) return req(false,'Not enough Energy.');
          if(s.age < 12) return req(false,'Need age 12+.');
          return req(true);
        },
        adventure:{ baseRisk: 0.02, kind:'quest', loot:[{id:'herb', min:0, max:1}], travelLike:true }
      },
      {
        id:'guildQuestSlimes', name:'Guild Quest: Slay 3 Slimes',
        meta:'Moderate risk. Requires at least Rank E. Drops slime gel.',
        minAge: 12,
        timeCostMins: 420, durationSec: 15, energyCost: 22,
        statGains:{ strength:2, magic:1 }, rewards:{ gold: 60, guildXP: 22 },
        requirements:(s)=>{
          if(!s.guild.registered) return req(false,'Register first.');
          if(rankIndex(s.guild.rank) > rankIndex('E')) return req(false,'Need Rank E or better.');
          if(s.energy < 22) return req(false,'Not enough Energy.');
          if(s.age < 12) return req(false,'Need age 12+.');
          return req(true);
        },
        adventure:{ baseRisk: 0.06, kind:'quest', loot:[{id:'slime_gel', min:1, max:3}], travelLike:true }
      },
      {
        id:'guildQuestWolves', name:'Guild Quest: Clear Wolves Near the Road',
        meta:'Requires Rank D. Wolves can be lethal, but the rewards are strong.',
        minAge: 14,
        timeCostMins: 600, durationSec: 15, energyCost: 28,
        statGains:{ strength:2, luck:1 }, rewards:{ gold: 120, guildXP: 44 },
        requirements:(s)=>{
          if(!s.guild.registered) return req(false,'Register first.');
          if(rankIndex(s.guild.rank) > rankIndex('D')) return req(false,'Need Rank D or better.');
          if(s.energy < 28) return req(false,'Not enough Energy.');
          if(s.age < 14) return req(false,'Too young (need age 14+).');
          return req(true);
        },
        adventure:{ baseRisk: 0.14, kind:'quest', loot:[{id:'wolf_hide', min:0, max:1},{id:'wolf_fang', min:1, max:2},{id:'wolf_meat', min:1, max:2}], travelLike:true }
      },
    ];

    if(infra){
      base.push({
        id:'guildQuestEscort', name:'Guild Quest: Escort Caravan (Improved Roads)',
        meta:'Safer with town infrastructure. Stronger rewards.',
        minAge: ADULT_AGE,
        timeCostMins: 720, durationSec: 15, energyCost: 30,
        statGains:{ charm:2, luck:1 }, rewards:{ gold: 180, guildXP: 70 },
        requirements:(s)=>{
          if(!s.guild.registered) return req(false,'Register first.');
          if(rankIndex(s.guild.rank) > rankIndex('C')) return req(false,'Need Rank C or better.');
          if(s.energy < 30) return req(false,'Not enough Energy.');
          if(s.age < ADULT_AGE) return req(false,`Need age ${ADULT_AGE}+.`);
          return req(true);
        },
        adventure:{ baseRisk: 0.10, kind:'quest', loot:[{id:'iron', min:0, max:1}], travelLike:true }
      });
    }

    if(townId.startsWith('city_')){
      for(const q of base){
        if(q.adventure) q.adventure.baseRisk = Math.max(0.01, q.adventure.baseRisk - 0.01);
      }
    }

    return base;
  }

  function getBlacksmithActionsForTown(townId){
    const t = getTownById(townId);
    if(!t?.facilities?.blacksmith) return [];

    return [
      {
        id:'smithBuyDagger', name:'Blacksmith: Buy Basic Dagger',
        meta:'A simple blade. Helps early hunts.',
        minAge: 12,
        timeCostMins: 30, durationSec: 5, energyCost: 2,
        requirements:(s)=>{
          if(s.gold < 60) return req(false,'Need 60 gold.');
          if(s.energy < 2) return req(false,'Not enough Energy.');
          if(s.age < 12) return req(false,'Need age 12+.');
          return req(true);
        },
        onComplete:(s)=>{ s.gold -= 60; s.gear.weaponId = 'dagger'; }
      },
      {
        id:'smithCommissionIronSword', name:'Blacksmith: Commission Iron Sword',
        meta:'Turn in Iron Ore x2 and gold. Better weapon, slightly safer fights.',
        minAge: 14,
        timeCostMins: 60, durationSec: 5, energyCost: 3,
        requirements:(s)=>{
          if(s.gold < 120) return req(false,'Need 120 gold.');
          if((s.inventory.iron||0) < 2) return req(false,'Need Iron Ore x2.');
          if(s.energy < 3) return req(false,'Not enough Energy.');
          if(s.age < 14) return req(false,'Need age 14+.');
          return req(true);
        },
        onComplete:(s)=>{ s.gold -= 120; removeItem(s.inventory, 'iron', 2); s.gear.weaponId = 'iron_sword'; }
      },
      {
        id:'smithCommissionLeatherArmor', name:'Blacksmith: Commission Leather Armor',
        meta:'Turn in Boar Hide x1 and gold. Solid early protection.',
        minAge: 12,
        timeCostMins: 60, durationSec: 5, energyCost: 3,
        requirements:(s)=>{
          if(s.gold < 90) return req(false,'Need 90 gold.');
          if((s.inventory.boar_hide||0) < 1) return req(false,'Need Boar Hide x1.');
          if(s.energy < 3) return req(false,'Not enough Energy.');
          if(s.age < 12) return req(false,'Need age 12+.');
          return req(true);
        },
        onComplete:(s)=>{ s.gold -= 90; removeItem(s.inventory, 'boar_hide', 1); s.gear.armorId = 'leather_armor'; }
      },
      {
        id:'smithCommissionWolfCloak', name:'Blacksmith: Commission Wolf-hide Cloak',
        meta:'Turn in Wolf Hide x1 and Wolf Fang x1, plus gold. Strong protection.',
        minAge: 14,
        timeCostMins: 90, durationSec: 5, energyCost: 3,
        requirements:(s)=>{
          if(s.gold < 140) return req(false,'Need 140 gold.');
          if((s.inventory.wolf_hide||0) < 1) return req(false,'Need Wolf Hide x1.');
          if((s.inventory.wolf_fang||0) < 1) return req(false,'Need Wolf Fang x1.');
          if(s.energy < 3) return req(false,'Not enough Energy.');
          if(s.age < 14) return req(false,'Need age 14+.');
          return req(true);
        },
        onComplete:(s)=>{ s.gold -= 140; removeItem(s.inventory,'wolf_hide',1); removeItem(s.inventory,'wolf_fang',1); s.gear.armorId='wolf_cloak'; }
      },
      {
        id:'smithCommissionIronArmor', name:'Blacksmith: Commission Iron Armor',
        meta:'Turn in Iron Ore x3 and gold. Heavy protection, expensive.',
        minAge: 18,
        timeCostMins: 120, durationSec: 5, energyCost: 4,
        requirements:(s)=>{
          if(s.gold < 220) return req(false,'Need 220 gold.');
          if((s.inventory.iron||0) < 3) return req(false,'Need Iron Ore x3.');
          if(s.energy < 4) return req(false,'Not enough Energy.');
          if(s.age < 18) return req(false,'Need age 18+.');
          return req(true);
        },
        onComplete:(s)=>{ s.gold -= 220; removeItem(s.inventory,'iron',3); s.gear.armorId='iron_armor'; }
      },
    ];
  }

  return {
    buildActions,
    getGuildQuestsForTown,
    getBlacksmithActionsForTown,
  };
}
