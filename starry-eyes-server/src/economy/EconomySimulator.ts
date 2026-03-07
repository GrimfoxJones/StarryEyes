import type {
  GeneratedSystem,
  StationData,
  CommodityId,
  StationEconomyState,
  MarketListing,
  TradeResult,
  StationArchetype,
} from '@starryeyes/shared';
import {
  COMMODITY_DEFS,
  ALL_COMMODITY_IDS,
  STATION_ARCHETYPE_DEFS,
  computePrice,
  computeSunlightFactor,
  initialStockpileFraction,
  computeSettlement,
} from '@starryeyes/shared';

function emptyStockpiles(): Record<CommodityId, number> {
  const s = {} as Record<CommodityId, number>;
  for (const id of ALL_COMMODITY_IDS) s[id] = 0;
  return s;
}

function emptyPrices(): Record<CommodityId, number> {
  const p = {} as Record<CommodityId, number>;
  for (const id of ALL_COMMODITY_IDS) p[id] = COMMODITY_DEFS[id].basePrice;
  return p;
}

/** bodyId → StationEconomyState */
export class EconomySimulator {
  private states: Map<string, StationEconomyState> = new Map();
  /** bodyId → StationData */
  private stationMap: Record<string, StationData>;
  private system: GeneratedSystem;
  private prevStockpiles: Map<string, Record<CommodityId, number>> = new Map();

  constructor(stations: Record<string, StationData>, system: GeneratedSystem, systemIndex: number) {
    this.stationMap = stations;
    this.system = system;

    const settlement = computeSettlement(system, systemIndex);
    const fillFraction = initialStockpileFraction(settlement.settlementLevel);

    for (const [bodyId, station] of Object.entries(stations)) {
      const archetype = station.archetype as StationArchetype;
      const archetypeDef = STATION_ARCHETYPE_DEFS[archetype];
      if (!archetypeDef) continue;

      const stockpiles = emptyStockpiles();
      const targets = emptyStockpiles();

      for (const [cid, rate] of Object.entries(archetypeDef.consumptionProfile)) {
        targets[cid as CommodityId] = (rate as number) * 24;
      }

      for (const facility of archetypeDef.facilities) {
        targets[facility.commodity] = Math.max(targets[facility.commodity], facility.storageCap);
      }

      for (const id of ALL_COMMODITY_IDS) {
        stockpiles[id] = targets[id] * fillFraction;
      }

      const prices = emptyPrices();
      for (const id of ALL_COMMODITY_IDS) {
        if (targets[id] > 0) {
          prices[id] = computePrice(COMMODITY_DEFS[id].basePrice, stockpiles[id], targets[id]);
        }
      }

      const state: StationEconomyState = {
        stationId: bodyId,
        archetype,
        stockpiles,
        targets,
        prices,
        population: station.initialPopulation,
        surfacePopulation: station.surfacePopulation ?? 0,
        supplyScore: fillFraction,
      };

      this.states.set(bodyId, state);
      this.prevStockpiles.set(bodyId, { ...stockpiles });
    }
  }

  tick(gameHoursDelta: number): void {
    for (const [bodyId, station] of Object.entries(this.stationMap)) {
      const state = this.states.get(bodyId);
      if (!state) continue;

      const archetype = station.archetype as StationArchetype;
      const archetypeDef = STATION_ARCHETYPE_DEFS[archetype];
      if (!archetypeDef) continue;

      this.prevStockpiles.set(bodyId, { ...state.stockpiles });

      // 1. Extraction
      for (const facility of archetypeDef.facilities) {
        if (facility.type !== 'extraction') continue;
        const rate = facility.efficiencyTier === 'high' ? 20 : 10;
        const produced = rate * gameHoursDelta;
        state.stockpiles[facility.commodity] = Math.min(
          state.stockpiles[facility.commodity] + produced,
          facility.storageCap,
        );
      }

      // 2. Manufacturing
      for (const facility of archetypeDef.facilities) {
        if (facility.type !== 'manufacturing' || !facility.recipe) continue;
        const recipe = facility.recipe;
        const rate = facility.efficiencyTier === 'high'
          ? recipe.outputPerHour * 1.5
          : recipe.outputPerHour;
        const maxOutput = rate * gameHoursDelta;

        let maxBatches = maxOutput;
        for (const [inputId, inputQty] of Object.entries(recipe.inputs)) {
          const available = state.stockpiles[inputId as CommodityId];
          if ((inputQty as number) > 0) {
            maxBatches = Math.min(maxBatches, available / (inputQty as number));
          }
        }
        maxBatches = Math.max(0, maxBatches);

        if (maxBatches > 0) {
          for (const [inputId, inputQty] of Object.entries(recipe.inputs)) {
            state.stockpiles[inputId as CommodityId] -= (inputQty as number) * maxBatches;
          }
          state.stockpiles[recipe.output] = Math.min(
            state.stockpiles[recipe.output] + maxBatches,
            facility.storageCap,
          );
        }
      }

      // 3. Sunlight bonus for habitat colonies
      if (archetype === 'habitat_colony') {
        const planet = this.system.planets.find(p => p.id === bodyId);
        const distFromStar = planet?.semiMajorAxis ?? 1.496e11;
        const sunlightFactor = computeSunlightFactor(distFromStar, this.system.star.luminositySolar);
        const bonusFood = 5 * sunlightFactor * gameHoursDelta;
        state.stockpiles.food = Math.min(state.stockpiles.food + bonusFood, 1000);
      }

      // 4. Population consumption (log-scaled for large surface populations)
      const effectivePop = state.population + state.surfacePopulation;
      const popFactor = effectivePop > 10000
        ? Math.log10(effectivePop) * (effectivePop / 10000)
        : effectivePop / 1000;
      state.stockpiles.food = Math.max(0, state.stockpiles.food - 2 * popFactor * gameHoursDelta);
      state.stockpiles.water = Math.max(0, state.stockpiles.water - 3 * popFactor * gameHoursDelta);

      // 5. Maintenance
      state.stockpiles.machine_parts = Math.max(0, state.stockpiles.machine_parts - 0.5 * gameHoursDelta);

      // 6. Consumption profile
      for (const [cid, rate] of Object.entries(archetypeDef.consumptionProfile)) {
        state.stockpiles[cid as CommodityId] = Math.max(
          0,
          state.stockpiles[cid as CommodityId] - (rate as number) * gameHoursDelta,
        );
      }

      // 7. Population growth
      let trackedCount = 0;
      let aboveHalf = 0;
      for (const id of ALL_COMMODITY_IDS) {
        if (state.targets[id] > 0) {
          trackedCount++;
          if (state.stockpiles[id] >= state.targets[id] * 0.5) aboveHalf++;
        }
      }
      state.supplyScore = trackedCount > 0 ? aboveHalf / trackedCount : 0;
      const targetPop = state.supplyScore * archetypeDef.populationCap;
      const popDrift = (targetPop - state.population) * 0.01 * gameHoursDelta;
      state.population = Math.max(archetypeDef.basePopulation * 0.5, state.population + popDrift);

      // 8. Price update
      for (const id of ALL_COMMODITY_IDS) {
        if (state.targets[id] > 0) {
          state.prices[id] = computePrice(COMMODITY_DEFS[id].basePrice, state.stockpiles[id], state.targets[id]);
        }
      }
    }
  }

  /** Check if a body has a station */
  hasStation(bodyId: string): boolean {
    return this.states.has(bodyId);
  }

  getMarketListings(bodyId: string): MarketListing[] {
    const state = this.states.get(bodyId);
    if (!state) return [];

    const prev = this.prevStockpiles.get(bodyId);
    const listings: MarketListing[] = [];

    for (const id of ALL_COMMODITY_IDS) {
      if (state.targets[id] <= 0 && state.stockpiles[id] <= 0) continue;

      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (prev) {
        const diff = state.stockpiles[id] - prev[id];
        if (diff > 0.5) trend = 'falling';
        else if (diff < -0.5) trend = 'rising';
      }

      listings.push({
        commodityId: id,
        name: COMMODITY_DEFS[id].name,
        stockpile: Math.round(state.stockpiles[id]),
        target: Math.round(state.targets[id]),
        price: Math.round(state.prices[id] * 100) / 100,
        basePrice: COMMODITY_DEFS[id].basePrice,
        trend,
      });
    }

    return listings;
  }

  executeTrade(bodyId: string, commodityId: CommodityId, quantity: number, isBuy: boolean): TradeResult {
    const state = this.states.get(bodyId);
    if (!state) {
      return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'No station at this body' };
    }

    const unitPrice = state.prices[commodityId] ?? COMMODITY_DEFS[commodityId].basePrice;

    if (isBuy) {
      if (state.stockpiles[commodityId] < quantity) {
        return { success: false, commodityId, quantity: 0, unitPrice, totalPrice: 0, error: 'Insufficient stock' };
      }
      state.stockpiles[commodityId] -= quantity;
    } else {
      state.stockpiles[commodityId] += quantity;
    }

    if (state.targets[commodityId] > 0) {
      state.prices[commodityId] = computePrice(COMMODITY_DEFS[commodityId].basePrice, state.stockpiles[commodityId], state.targets[commodityId]);
    }

    return {
      success: true,
      commodityId,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    };
  }

  getState(bodyId: string): StationEconomyState | undefined {
    return this.states.get(bodyId);
  }

  getAllStates(): StationEconomyState[] {
    return [...this.states.values()];
  }
}
