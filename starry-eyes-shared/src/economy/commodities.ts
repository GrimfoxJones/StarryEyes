import type { CommodityId, CommodityDef, Recipe, StationArchetype, StationArchetypeDef, FacilityDef } from './types.js';

// ── Commodity Definitions ────────────────────────────────────────────

export const COMMODITY_DEFS: Record<CommodityId, CommodityDef> = {
  // Extracted
  water:          { id: 'water',          name: 'Water',           category: 'extracted',     baseMass: 1,   basePrice: 10 },
  common_metals:  { id: 'common_metals',  name: 'Common Metals',   category: 'extracted',     baseMass: 5,   basePrice: 25 },
  rare_metals:    { id: 'rare_metals',    name: 'Rare Metals',     category: 'extracted',     baseMass: 3,   basePrice: 120 },
  silicates:      { id: 'silicates',      name: 'Silicates',       category: 'extracted',     baseMass: 4,   basePrice: 15 },
  carbon:         { id: 'carbon',         name: 'Carbon',          category: 'extracted',     baseMass: 2,   basePrice: 20 },
  volatiles:      { id: 'volatiles',      name: 'Volatiles',       category: 'extracted',     baseMass: 1,   basePrice: 30 },
  // Manufactured
  food:           { id: 'food',           name: 'Food',            category: 'manufactured',  baseMass: 1,   basePrice: 40 },
  fuel:           { id: 'fuel',           name: 'Fuel',            category: 'manufactured',  baseMass: 2,   basePrice: 35 },
  machine_parts:  { id: 'machine_parts',  name: 'Machine Parts',   category: 'manufactured',  baseMass: 8,   basePrice: 80 },
  electronics:    { id: 'electronics',    name: 'Electronics',     category: 'manufactured',  baseMass: 2,   basePrice: 150 },
  composites:     { id: 'composites',     name: 'Composites',      category: 'manufactured',  baseMass: 3,   basePrice: 60 },
  pharmaceuticals:{ id: 'pharmaceuticals',name: 'Pharmaceuticals', category: 'manufactured',  baseMass: 0.5, basePrice: 200 },
  weapons:        { id: 'weapons',        name: 'Weapons',         category: 'manufactured',  baseMass: 5,   basePrice: 250 },
  ship_components:{ id: 'ship_components',name: 'Ship Components', category: 'manufactured',  baseMass: 10,  basePrice: 300 },
};

export const ALL_COMMODITY_IDS = Object.keys(COMMODITY_DEFS) as CommodityId[];

// ── Economy Constants ─────────────────────────────────────────────────

export const RESERVE_HOURS = 6;           // hours of production held as reserve
export const SPREAD_MARGIN = 0.15;        // 15% bid/ask spread
export const PRICE_SMOOTHING = 0.3;       // 30% toward new value per tick
export const PRICE_FLOOR = 0.1;           // 10% of base price minimum
export const PRICE_CEILING = 10.0;        // 10x base price maximum
export const IMPORT_STOCKPILE_MULTIPLIER = 2.0; // max import stockpile = target * this

// ── Manufacturing Recipes ────────────────────────────────────────────

export const RECIPES: Recipe[] = [
  { output: 'food',            inputs: { water: 1 },                              outputPerHour: 20 },
  { output: 'fuel',            inputs: { volatiles: 1 },                          outputPerHour: 15 },
  { output: 'machine_parts',   inputs: { common_metals: 1 },                      outputPerHour: 10 },
  { output: 'electronics',     inputs: { rare_metals: 1, silicates: 1 },          outputPerHour: 5 },
  { output: 'composites',      inputs: { silicates: 1, carbon: 1 },               outputPerHour: 12 },
  { output: 'pharmaceuticals', inputs: { water: 1, carbon: 1 },                   outputPerHour: 4 },
  { output: 'weapons',         inputs: { common_metals: 1, electronics: 1 },      outputPerHour: 3 },
  { output: 'ship_components', inputs: { common_metals: 1, machine_parts: 1 },    outputPerHour: 2 },
];

// ── Facility Helpers ─────────────────────────────────────────────────

function extraction(commodity: CommodityId, tier: 'low' | 'high' = 'low', storageCap = 500): FacilityDef {
  return { type: 'extraction', commodity, recipe: null, storageCap, efficiencyTier: tier };
}

function manufacturing(recipe: Recipe, tier: 'low' | 'high' = 'low', storageCap = 300): FacilityDef {
  return { type: 'manufacturing', commodity: recipe.output, recipe, storageCap, efficiencyTier: tier };
}

function findRecipe(output: CommodityId): Recipe {
  return RECIPES.find(r => r.output === output)!;
}

// ── Station Archetype Definitions ────────────────────────────────────

export const STATION_ARCHETYPE_DEFS: Record<StationArchetype, StationArchetypeDef> = {
  mining_outpost: {
    archetype: 'mining_outpost',
    name: 'Mining Outpost',
    facilities: [
      extraction('common_metals', 'high', 800),
      extraction('rare_metals', 'low', 400),
      extraction('silicates', 'low', 600),
    ],
    consumptionProfile: { food: 5, water: 8, machine_parts: 1 },
    exports: ['common_metals', 'rare_metals', 'silicates'],
    imports: ['food', 'water', 'machine_parts'],
    basePopulation: 50,
    populationCap: 200,
  },
  habitat_colony: {
    archetype: 'habitat_colony',
    name: 'Habitat Colony',
    facilities: [
      manufacturing(findRecipe('food'), 'high', 1000),
      manufacturing(findRecipe('pharmaceuticals'), 'low', 200),
    ],
    consumptionProfile: { water: 15, machine_parts: 2, electronics: 1 },
    exports: ['food', 'pharmaceuticals'],
    imports: ['water', 'machine_parts', 'electronics'],
    basePopulation: 500,
    populationCap: 5000,
  },
  water_depot: {
    archetype: 'water_depot',
    name: 'Water Depot',
    facilities: [
      extraction('water', 'high', 2000),
      manufacturing(findRecipe('fuel'), 'low', 500),
    ],
    consumptionProfile: { food: 8, machine_parts: 1 },
    exports: ['water', 'fuel'],
    imports: ['food', 'machine_parts'],
    basePopulation: 80,
    populationCap: 300,
  },
  military_base: {
    archetype: 'military_base',
    name: 'Military Base',
    facilities: [
      manufacturing(findRecipe('weapons'), 'high', 400),
      manufacturing(findRecipe('composites'), 'low', 300),
    ],
    consumptionProfile: { food: 12, water: 10, fuel: 5, machine_parts: 3, electronics: 2 },
    exports: ['weapons', 'composites'],
    imports: ['food', 'water', 'fuel', 'machine_parts', 'electronics'],
    basePopulation: 200,
    populationCap: 1000,
  },
  shipyard: {
    archetype: 'shipyard',
    name: 'Shipyard',
    facilities: [
      manufacturing(findRecipe('ship_components'), 'high', 200),
      manufacturing(findRecipe('machine_parts'), 'high', 500),
    ],
    consumptionProfile: { food: 10, water: 8, common_metals: 10, rare_metals: 3, electronics: 5 },
    exports: ['ship_components', 'machine_parts'],
    imports: ['food', 'water', 'common_metals', 'rare_metals', 'electronics'],
    basePopulation: 300,
    populationCap: 2000,
  },
  weapon_factory: {
    archetype: 'weapon_factory',
    name: 'Weapon Factory',
    facilities: [
      manufacturing(findRecipe('weapons'), 'high', 500),
      manufacturing(findRecipe('electronics'), 'low', 300),
    ],
    consumptionProfile: { food: 8, water: 6, common_metals: 8, machine_parts: 2 },
    exports: ['weapons', 'electronics'],
    imports: ['food', 'water', 'common_metals', 'machine_parts'],
    basePopulation: 150,
    populationCap: 800,
  },
};
