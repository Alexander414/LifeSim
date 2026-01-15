export const BASE_TOWNS = [
  { id:'town_rivergate', name:'Rivergate', kind:'Town', desc:'A riverside trading stop with a modest guild hall.', hidden:false },
  { id:'town_stonevale', name:'Stonevale', kind:'Town', desc:'A mining community built into the foothills.', hidden:false },
  { id:'city_aurum', name:'Aurum City', kind:'City', desc:'A bright capital-adjacent city with strict patrols and opportunities.', hidden:false },
  { id:'hidden_1', name:null, kind:'Town', desc:'(Hidden)', hidden:true },
  { id:'hidden_2', name:null, kind:'Town', desc:'(Hidden)', hidden:true },
];

export const FAMILIES = [
  { id:'humble', name:'Humble Home', desc:'Simple family. Balanced start. Small safety net.', mods:{ gold:20, energyMax:100, healthMax:100 } },
  { id:'merchant', name:'Merchant Family', desc:'A bit of money and social access. Easier early trades.', mods:{ gold:60, charm:3, luck:2, energyMax:100, healthMax:100 } },
  { id:'scholar', name:'Scholar Household', desc:'Books everywhere. Faster intelligence and magic learning.', mods:{ intelligence:5, magic:4, gold:25, energyMax:95, healthMax:100 } },
  { id:'woodsman', name:'Woodsman Cabin', desc:'Rugged upbringing. Stronger body, less comfort.', mods:{ strength:6, healthMax:110, energyMax:95, gold:15 } },
];

export const CLASSES = [
  { id:'none', name:'Unassigned', desc:'No class chosen yet.', mods:{} },
  { id:'adventurer', name:'Adventurer', desc:'Safer quests and faster guild growth.', mods:{ riskMitigate:0.03, guildXPMult:1.15 } },
  { id:'mage', name:'Mage', desc:'Better magic growth; stronger spellwork.', mods:{ magicGainMult:1.25 } },
  { id:'gatherer', name:'Gatherer', desc:'More loot from gathering/mining.', mods:{ lootMult:1.35 } },
  { id:'tamer', name:'Tamer', desc:'Lower risk in the wild; better with beasts.', mods:{ riskMitigate:0.02, luckGainMult:1.10 } },
];

export const ITEM_NAMES = {
  herb:'Herb Bundle',
  iron:'Iron Ore',
  copper:'Copper Ore',
  slime_gel:'Slime Gel',
  boar_meat:'Boar Meat',
  boar_hide:'Boar Hide',
  wolf_meat:'Wolf Meat',
  wolf_fang:'Wolf Fang',
  wolf_hide:'Wolf Hide',
  stone:'Stone',
};

export const GEAR = [
  { id:'none', name:'None', slot:'any', power:0, riskMitigate:0 },
  { id:'dagger', name:'Basic Dagger', slot:'weapon', power:6, riskMitigate:0.00 },
  { id:'iron_sword', name:'Iron Sword', slot:'weapon', power:14, riskMitigate:0.01 },
  { id:'leather_armor', name:'Leather Armor', slot:'armor', power:0, riskMitigate:0.03 },
  { id:'wolf_cloak', name:'Wolf-hide Cloak', slot:'armor', power:0, riskMitigate:0.05 },
  { id:'iron_armor', name:'Iron Armor', slot:'armor', power:0, riskMitigate:0.07 },
];

export function getGearById(id){ return GEAR.find(g=>g.id===id) || GEAR[0]; }
export function gearLabel(id){ return (GEAR.find(g=>g.id===id)?.name) || id; }
