import type {
  GeneratedSystem,
  StationData,
  CommodityId,
  CommodityRole,
  StationEconomyState,
  MarketListing,
  TradeResult,
  StationArchetype,
  SystemAverages,
  BodyTradeSummary,
} from '@starryeyes/shared';
import {
  COMMODITY_DEFS,
  ALL_COMMODITY_IDS,
  STATION_ARCHETYPE_DEFS,
  RESERVE_HOURS,
  PRICE_SMOOTHING,
  IMPORT_STOCKPILE_MULTIPLIER,
  computeAskPrice,
  computeBidPrice,
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

/** bodyId -> StationEconomyState */
export class EconomySimulator {
  private states: Map<string, StationEconomyState> = new Map();
  private stationMap: Record<string, StationData>;
  private system: GeneratedSystem;
  private prevStockpiles: Map<string, Record<CommodityId, number>> = new Map();
  private systemAverages: SystemAverages = {};

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
      const reserves = emptyStockpiles();
      const roles: Partial<Record<CommodityId, CommodityRole>> = {};

      // Set roles from archetype
      for (const id of archetypeDef.exports) roles[id] = 'export';
      for (const id of archetypeDef.imports) roles[id] = 'import';

      // Set targets: consumption profile * 24 for imports, facility storage cap for exports
      for (const [cid, rate] of Object.entries(archetypeDef.consumptionProfile)) {
        targets[cid as CommodityId] = (rate as number) * 24;
      }
      for (const facility of archetypeDef.facilities) {
        targets[facility.commodity] = Math.max(targets[facility.commodity], facility.storageCap);
      }

      // Compute reserves for exports based on production rate
      for (const facility of archetypeDef.facilities) {
        if (roles[facility.commodity] === 'export') {
          const rate = facility.type === 'extraction'
            ? (facility.efficiencyTier === 'high' ? 20 : 10)
            : (facility.recipe
              ? facility.efficiencyTier === 'high'
                ? facility.recipe.outputPerHour * 1.5
                : facility.recipe.outputPerHour
              : 0);
          reserves[facility.commodity] = Math.max(reserves[facility.commodity], rate * RESERVE_HOURS);
        }
      }

      // Initialize stockpiles
      for (const id of ALL_COMMODITY_IDS) {
        stockpiles[id] = targets[id] * fillFraction;
      }

      // Initialize prices
      const bidPrices = emptyPrices();
      const askPrices = emptyPrices();
      for (const id of ALL_COMMODITY_IDS) {
        const base = COMMODITY_DEFS[id].basePrice;
        if (roles[id] === 'export') {
          const available = Math.max(0, stockpiles[id] - reserves[id]);
          askPrices[id] = computeAskPrice(base, targets[id] || 1, available || 1);
        } else if (roles[id] === 'import') {
          bidPrices[id] = computeBidPrice(base, targets[id] || 1, stockpiles[id] || 1);
        }
      }

      const state: StationEconomyState = {
        stationId: bodyId,
        archetype,
        stockpiles,
        targets,
        reserves,
        roles,
        bidPrices,
        askPrices,
        population: station.initialPopulation,
        surfacePopulation: station.surfacePopulation ?? 0,
        supplyScore: fillFraction,
      };

      this.states.set(bodyId, state);
      this.prevStockpiles.set(bodyId, { ...stockpiles });
    }

    // Compute initial system averages
    this.updateSystemAverages();
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

      // 8. Price update with smoothing (only on tick, not on trade)
      for (const id of ALL_COMMODITY_IDS) {
        const base = COMMODITY_DEFS[id].basePrice;
        if (state.roles[id] === 'export') {
          const available = Math.max(0, state.stockpiles[id] - state.reserves[id]);
          const rawAsk = computeAskPrice(base, state.targets[id] || 1, available || 1);
          state.askPrices[id] += PRICE_SMOOTHING * (rawAsk - state.askPrices[id]);
        } else if (state.roles[id] === 'import') {
          const rawBid = computeBidPrice(base, state.targets[id] || 1, state.stockpiles[id] || 1);
          state.bidPrices[id] += PRICE_SMOOTHING * (rawBid - state.bidPrices[id]);
        }
      }
    }

    // Update system-wide averages
    this.updateSystemAverages();
  }

  private updateSystemAverages(): void {
    const avgData: Record<string, { askTotal: number; askCount: number; bidTotal: number; bidCount: number }> = {};

    for (const state of this.states.values()) {
      for (const id of ALL_COMMODITY_IDS) {
        if (!avgData[id]) avgData[id] = { askTotal: 0, askCount: 0, bidTotal: 0, bidCount: 0 };
        if (state.roles[id] === 'export') {
          avgData[id].askTotal += state.askPrices[id];
          avgData[id].askCount++;
        } else if (state.roles[id] === 'import') {
          avgData[id].bidTotal += state.bidPrices[id];
          avgData[id].bidCount++;
        }
      }
    }

    const averages: SystemAverages = {};
    for (const [id, data] of Object.entries(avgData)) {
      averages[id] = {
        avgAskPrice: data.askCount > 0 ? data.askTotal / data.askCount : null,
        avgBidPrice: data.bidCount > 0 ? data.bidTotal / data.bidCount : null,
      };
    }
    this.systemAverages = averages;
  }

  getSystemAverages(): SystemAverages {
    return this.systemAverages;
  }

  hasStation(bodyId: string): boolean {
    return this.states.has(bodyId);
  }

  getMarketListings(bodyId: string): MarketListing[] {
    const state = this.states.get(bodyId);
    if (!state) return [];

    const prev = this.prevStockpiles.get(bodyId);
    const listings: MarketListing[] = [];
    const archetype = state.archetype;
    const archetypeDef = STATION_ARCHETYPE_DEFS[archetype];
    if (!archetypeDef) return [];

    // Only list commodities with a role (exports + imports)
    for (const id of ALL_COMMODITY_IDS) {
      const role = state.roles[id];
      if (!role) continue;

      let trend: 'rising' | 'falling' | 'stable' = 'stable';
      if (prev) {
        const diff = state.stockpiles[id] - prev[id];
        if (diff > 0.5) trend = 'falling';
        else if (diff < -0.5) trend = 'rising';
      }

      let available: number;
      let price: number;
      let outOfStock = false;
      let fullyStocked = false;

      if (role === 'export') {
        available = Math.max(0, Math.round(state.stockpiles[id] - state.reserves[id]));
        price = state.askPrices[id];
        outOfStock = available <= 0;
      } else {
        const maxImport = state.targets[id] * IMPORT_STOCKPILE_MULTIPLIER;
        available = Math.max(0, Math.round(maxImport - state.stockpiles[id]));
        price = state.bidPrices[id];
        fullyStocked = available <= 0;
      }

      const sysAvg = this.systemAverages[id];
      const systemAvgPrice = role === 'export'
        ? (sysAvg?.avgAskPrice ?? price)
        : (sysAvg?.avgBidPrice ?? price);

      listings.push({
        commodityId: id,
        name: COMMODITY_DEFS[id].name,
        role,
        stockpile: Math.round(state.stockpiles[id]),
        target: Math.round(state.targets[id]),
        available,
        price: Math.round(price * 100) / 100,
        basePrice: COMMODITY_DEFS[id].basePrice,
        systemAvgPrice: Math.round(systemAvgPrice * 100) / 100,
        trend,
        outOfStock,
        fullyStocked,
      });
    }

    return listings;
  }

  getTradeSummaries(): BodyTradeSummary[] {
    const summaries: BodyTradeSummary[] = [];

    for (const [bodyId, state] of this.states) {
      const station = this.stationMap[bodyId];
      if (!station) continue;

      const imports: BodyTradeSummary['imports'] = [];
      const exports: BodyTradeSummary['exports'] = [];

      for (const id of ALL_COMMODITY_IDS) {
        const role = state.roles[id];
        if (!role) continue;

        if (role === 'import') {
          const target = state.targets[id];
          const ratio = target > 0 ? state.stockpiles[id] / target : 1;
          let demandLevel: 0 | 1 | 2 | 3;
          if (ratio < 0.25) demandLevel = 3;
          else if (ratio < 0.50) demandLevel = 2;
          else if (ratio < 0.75) demandLevel = 1;
          else demandLevel = 0;
          imports.push({ commodityId: id, name: COMMODITY_DEFS[id].name, demandLevel });
        } else {
          const available = Math.max(0, state.stockpiles[id] - state.reserves[id]);
          exports.push({ commodityId: id, name: COMMODITY_DEFS[id].name, outOfStock: available <= 0 });
        }
      }

      summaries.push({ bodyId, stationName: station.name, imports, exports });
    }

    return summaries;
  }

  executeTrade(bodyId: string, commodityId: CommodityId, quantity: number, isBuy: boolean): TradeResult {
    const state = this.states.get(bodyId);
    if (!state) {
      return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'No station at this body' };
    }

    const role = state.roles[commodityId];
    const commodityName = COMMODITY_DEFS[commodityId].name;

    if (isBuy) {
      // Player buying from station — must be an export
      if (role !== 'export') {
        return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: `This station does not sell ${commodityName}` };
      }

      const available = Math.max(0, state.stockpiles[commodityId] - state.reserves[commodityId]);
      const actualQty = Math.min(quantity, Math.floor(available));
      if (actualQty <= 0) {
        return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: 'Out of stock' };
      }

      const unitPrice = state.askPrices[commodityId];
      state.stockpiles[commodityId] -= actualQty;
      // Prices NOT updated here — only on tick

      return { success: true, commodityId, quantity: actualQty, unitPrice, totalPrice: unitPrice * actualQty };
    } else {
      // Player selling to station — must be an import
      if (role !== 'import') {
        return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: `This station does not buy ${commodityName}` };
      }

      const maxImport = state.targets[commodityId] * IMPORT_STOCKPILE_MULTIPLIER;
      const remaining = maxImport - state.stockpiles[commodityId];
      if (remaining <= 0) {
        return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: `${commodityName} fully stocked` };
      }

      const actualQty = Math.min(quantity, Math.floor(remaining));
      if (actualQty <= 0) {
        return { success: false, commodityId, quantity: 0, unitPrice: 0, totalPrice: 0, error: `${commodityName} fully stocked` };
      }

      const unitPrice = state.bidPrices[commodityId];
      state.stockpiles[commodityId] += actualQty;
      // Prices NOT updated here — only on tick

      return { success: true, commodityId, quantity: actualQty, unitPrice, totalPrice: unitPrice * actualQty };
    }
  }

  getState(bodyId: string): StationEconomyState | undefined {
    return this.states.get(bodyId);
  }

  getAllStates(): StationEconomyState[] {
    return [...this.states.values()];
  }
}
