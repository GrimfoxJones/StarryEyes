// ── Commodity Definitions ────────────────────────────────────────────

export type CommodityId =
  // Extracted
  | 'water'
  | 'common_metals'
  | 'rare_metals'
  | 'silicates'
  | 'carbon'
  | 'volatiles'
  // Manufactured
  | 'food'
  | 'fuel'
  | 'machine_parts'
  | 'electronics'
  | 'composites'
  | 'pharmaceuticals'
  | 'weapons'
  | 'ship_components';

export type CommodityCategory = 'extracted' | 'manufactured';

export interface CommodityDef {
  id: CommodityId;
  name: string;
  category: CommodityCategory;
  baseMass: number;   // kg per unit
  basePrice: number;  // credits per unit
}

// ── Recipes ─────────────────────────────────────────────────────────

export interface Recipe {
  output: CommodityId;
  inputs: Partial<Record<CommodityId, number>>;
  outputPerHour: number;
}

// ── Facilities ──────────────────────────────────────────────────────

export type FacilityType = 'extraction' | 'manufacturing';

export interface FacilityDef {
  type: FacilityType;
  commodity: CommodityId;
  recipe: Recipe | null;
  storageCap: number;
  efficiencyTier: 'low' | 'high';
}

// ── Commodity Roles ─────────────────────────────────────────────────

export type CommodityRole = 'export' | 'import';

// ── Station Archetypes ──────────────────────────────────────────────

export type StationArchetype =
  | 'mining_outpost'
  | 'habitat_colony'
  | 'water_depot'
  | 'military_base'
  | 'shipyard'
  | 'weapon_factory';

export interface StationArchetypeDef {
  archetype: StationArchetype;
  name: string;
  facilities: FacilityDef[];
  consumptionProfile: Partial<Record<CommodityId, number>>;
  exports: CommodityId[];
  imports: CommodityId[];
  basePopulation: number;
  populationCap: number;
}

// ── Economy State ───────────────────────────────────────────────────

export interface StationEconomyState {
  stationId: string;
  archetype: StationArchetype;
  stockpiles: Record<CommodityId, number>;
  targets: Record<CommodityId, number>;
  reserves: Record<CommodityId, number>;
  roles: Partial<Record<CommodityId, CommodityRole>>;
  bidPrices: Record<CommodityId, number>;
  askPrices: Record<CommodityId, number>;
  population: number;
  surfacePopulation: number;
  supplyScore: number;
}

// ── Client-facing Market Data ───────────────────────────────────────

export interface MarketListing {
  commodityId: CommodityId;
  name: string;
  role: CommodityRole;
  stockpile: number;
  target: number;
  available: number;        // availableForSale for exports, remaining capacity for imports
  price: number;            // askPrice for exports, bidPrice for imports
  basePrice: number;
  systemAvgPrice: number;   // system average for comparison
  trend: 'rising' | 'falling' | 'stable';
  outOfStock: boolean;      // true if export with 0 available
  fullyStocked: boolean;    // true if import at max capacity
}

// ── System Average Prices ───────────────────────────────────────────

export interface SystemAverages {
  [commodityId: string]: {
    avgAskPrice: number | null;
    avgBidPrice: number | null;
  };
}

// ── Trade Summary (for body popups) ─────────────────────────────────

export interface BodyTradeSummary {
  bodyId: string;
  stationName: string;
  imports: { commodityId: string; name: string; demandLevel: 0 | 1 | 2 | 3 }[];
  exports: { commodityId: string; name: string; outOfStock: boolean }[];
}

// ── Cargo & Trade ───────────────────────────────────────────────────

export type CargoManifest = Partial<Record<CommodityId, number>>;

export interface TradeResult {
  success: boolean;
  commodityId: CommodityId;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  error?: string;
}

// ── Player Economy ──────────────────────────────────────────────────

export interface PlayerEconomy {
  credits: number;
  costBasis: Partial<Record<CommodityId, number>>; // weighted avg buy price per commodity
}
