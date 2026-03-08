# StarryEyes: Economy Redesign Spec

Design specification for overhauling the station economy, pricing model, trade mechanics, and related UI. This document is intended to be ingested by a coding agent and covers all changes needed across shared definitions, server simulation, and client display.

---

## Table of Contents

1. [Design Goals](#design-goals)
2. [Commodity Roles](#commodity-roles)
3. [Archetype Role Assignments](#archetype-role-assignments)
4. [Reserves](#reserves)
5. [Bid/Ask Pricing](#bidask-pricing)
6. [Damped Price Updates & Tick Interval](#damped-price-updates--tick-interval)
7. [System Average Prices](#system-average-prices)
8. [Cargo Hold Rebalance](#cargo-hold-rebalance)
9. [UI: At-a-Glance Body Info](#ui-at-a-glance-body-info)
10. [UI: Market Panel Updates](#ui-market-panel-updates)
11. [Migration Summary by File](#migration-summary-by-file)

---

## Design Goals

The current economy has several gameplay problems this redesign addresses:

- **No trade direction visibility.** Players cannot tell at a glance where to sell a commodity they're carrying. They must dock at each station and inspect the market.
- **No price reference.** There is no system-wide average price, so players can't evaluate whether a deal is good or bad.
- **Instant price feedback creates arbitrage.** Buying a commodity instantly raises its price; selling it back immediately can be profitable. This makes no economic sense.
- **Stations trade everything symmetrically.** A mining outpost will buy ore it produces. Stations sell their own life-support water. There is no concept of what a station is "in the business of" trading.
- **Stations sell critical reserves.** A station will sell all of a commodity it needs internally, creating absurd buy-back loops.

---

## Commodity Roles

### Concept

Every commodity at every station is classified into exactly one of three roles:

| Role | Station Behavior | Player Can... |
|------|-----------------|---------------|
| **export** | Station produces this and sells it to ships | Buy from station |
| **import** | Station consumes this and buys it from ships | Sell to station |
| **excluded** | Station has no interest in this commodity | Neither (not listed) |

This replaces the current model where every commodity with a non-zero target is both buyable and sellable.

### Rules

- A commodity that is an **export** can ONLY be bought by the player (the station sells).
- A commodity that is an **import** can ONLY be sold by the player (the station buys).
- A commodity cannot be both export and import at the same station.
- **Excluded** commodities do not appear in the station's market listings at all.

### Data Model Change

In `shared/src/economy/commodities.ts`, each archetype definition should include explicit `exports` and `imports` arrays of commodity IDs. Anything not listed is excluded.

```typescript
interface ArchetypeEconomyDef {
  exports: CommodityId[];   // station sells these to players
  imports: CommodityId[];   // station buys these from players
  // ... existing facilities, consumption, population fields
}
```

### Trade Execution Change

In `server/src/economy/EconomySimulator.ts` — `executeTrade()`:

- If `isBuy` (player buying from station): validate commodity is in station's `exports` list. Reject otherwise.
- If `!isBuy` (player selling to station): validate commodity is in station's `imports` list. Reject otherwise.

Return a clear error message: `"This station does not buy/sell {commodityName}"`.

---

## Archetype Role Assignments

Derived from the existing facility and consumption definitions. Each archetype's exports come from what it produces; imports come from what it consumes plus manufacturing inputs it doesn't produce itself.

### Mining Outpost

| Exports | Imports |
|---------|---------|
| Common Metals | Food |
| Rare Metals | Water |
| Silicates | Machine Parts |

Rationale: Extracts ores and minerals. Needs life support and maintenance supplies. Has no business dealing in electronics, weapons, pharmaceuticals, etc.

### Water Depot

| Exports | Imports |
|---------|---------|
| Water | Food |
| Fuel | Machine Parts |

Rationale: Extracts water, manufactures fuel from volatiles. Needs food and maintenance.

### Habitat Colony

| Exports | Imports |
|---------|---------|
| Food | Water |
| Pharmaceuticals | Machine Parts |
| | Electronics |

Rationale: Food production hub with pharma manufacturing. Needs water for population, parts for maintenance, electronics for infrastructure.

### Military Base

| Exports | Imports |
|---------|---------|
| Weapons | Food |
| Composites | Water |
| | Fuel |
| | Machine Parts |
| | Electronics |

Rationale: Weapons and composites manufacturing. Heavy consumption across the board due to military operations.

### Shipyard

| Exports | Imports |
|---------|---------|
| Ship Components | Food |
| Machine Parts | Water |
| | Common Metals |
| | Rare Metals |
| | Electronics |

Rationale: Builds ships and parts. Hungry for raw metals and electronics as manufacturing inputs.

### Weapon Factory

| Exports | Imports |
|---------|---------|
| Weapons | Food |
| Electronics | Water |
| | Common Metals |
| | Machine Parts |

Rationale: Weapons manufacturing with secondary electronics line. Needs metals as manufacturing feedstock.

---

## Reserves

### Concept

Stations maintain a **reserve** of each commodity they produce (exports) representing internal operational needs. This reserve is not available for sale to players.

### Export Reserves

For each export commodity, the reserve equals the station's production rate multiplied by a reserve buffer period:

```
reserve = productionRate * RESERVE_HOURS
```

`RESERVE_HOURS` = 6 (tunable constant). This means a mining outpost producing common metals at 20/hr holds back 120 units as reserve.

The quantity available for a player to buy:

```
availableForSale = max(0, stockpile - reserve)
```

If `availableForSale` is 0, the station still lists the commodity but shows "Out of Stock" — the player can see it's an export and will restock, but can't buy right now.

### Import Target Buffer

For imports, the existing `target` system remains but is clarified: the target represents the level the station is trying to maintain. Stations always accept player sales of import commodities up to a maximum stockpile cap:

```
maxImportStockpile = target * 2.0
```

If an import commodity's stockpile is at or above `maxImportStockpile`, the station stops buying (shows "Fully Stocked"). This prevents players from dumping unlimited quantities.

### Implementation

Add to each station's runtime state:

```typescript
interface StationCommodityState {
  stockpile: number;
  target: number;
  reserve: number;           // NEW: calculated from production rate * RESERVE_HOURS
  role: 'export' | 'import'; // NEW: from archetype definition
  bidPrice: number;          // NEW: replaces single 'price'
  askPrice: number;          // NEW: replaces single 'price'
}
```

---

## Bid/Ask Pricing

### Concept

Replace the single price per commodity with two prices:

- **Ask price**: What the station charges when the player buys (export commodities only).
- **Bid price**: What the station pays when the player sells (import commodities only).

The spread between bid and ask ensures the station always profits on round-trip trades and eliminates buy-sell arbitrage.

### Formulas

**Ask price** (player buys exports):

```
askPrice = basePrice * (target / availableForSale) ^ exponent * (1 + spreadMargin)
```

Where `availableForSale = max(1, stockpile - reserve)` (floor of 1 to avoid division by zero; if truly out of stock, show "Out of Stock" instead of a price).

**Bid price** (player sells imports):

```
bidPrice = basePrice * (target / stockpile) ^ exponent * (1 - spreadMargin)
```

Where `stockpile` is the current import stockpile (floor of 1 to avoid division by zero).

### Constants

```typescript
const SPREAD_MARGIN = 0.15;        // 15% spread (tunable)
const PRICE_EXPONENT = 1.0;        // linear response (same as current)
const PRICE_FLOOR = 0.1;           // 10% of base price minimum
const PRICE_CEILING = 10.0;        // 10x base price maximum
```

Both bid and ask are clamped to `[basePrice * PRICE_FLOOR, basePrice * PRICE_CEILING]`.

### File Changes

Replace `calculatePrice()` in `shared/src/economy/pricing.ts` with two functions:

```typescript
function calculateAskPrice(basePrice: number, target: number, availableForSale: number): number
function calculateBidPrice(basePrice: number, target: number, stockpile: number): number
```

The existing `calculatePrice()` can be removed or kept as an internal helper.

---

## Damped Price Updates & Tick Interval

### Tick Interval

Change the economy tick from once-per-game-hour to a **wall-clock interval of 30 seconds**.

All production and consumption rates remain defined in per-game-hour units. Each tick calculates elapsed game-hours since the last tick and scales accordingly:

```typescript
const elapsedGameHours = (currentGameTime - lastTickGameTime) / 3600;
const produced = facility.rate * elapsedGameHours;
const consumed = consumption.rate * elapsedGameHours;
```

This decouples the tick interval from the economic math, making it safe to retune the interval later without rebalancing rates.

### Price Update Timing

Prices are recalculated **only on tick**, not on every trade.

**Trades** mutate stockpiles immediately (so concurrent trades correctly reduce available inventory), but the `bidPrice` and `askPrice` fields displayed in the market UI only update when the next 30-second tick fires.

This means:
- A player buys 50 water → stockpile drops by 50 immediately → the next player trying to buy validates against the reduced stockpile → but the displayed price doesn't change until the next tick.
- No more "buy, watch price spike, sell back" exploit. The price board feels like a real market that updates periodically.

### Price Smoothing

On each tick, apply exponential smoothing rather than snapping to the new calculated price:

```typescript
const PRICE_SMOOTHING = 0.3; // 30% toward new value per tick (tunable)

const rawAsk = calculateAskPrice(basePrice, target, availableForSale);
askPrice = previousAskPrice + PRICE_SMOOTHING * (rawAsk - previousAskPrice);

const rawBid = calculateBidPrice(basePrice, target, stockpile);
bidPrice = previousBidPrice + PRICE_SMOOTHING * (rawBid - previousBidPrice);
```

This gives the economy inertia. Large trades cause the price to drift rather than jump. Over several ticks (1.5–2 minutes of wall time), prices converge to their equilibrium. The economy feels like it has mass.

---

## System Average Prices

### Concept

On each economy tick, compute system-wide average prices for every commodity that is actively traded in the system. This gives players a reference point for evaluating deals.

### Calculation

At the end of each tick, after all station prices are updated:

```typescript
interface SystemAverages {
  [commodityId: string]: {
    avgAskPrice: number | null;  // average across all stations that export this
    avgBidPrice: number | null;  // average across all stations that import this
  };
}
```

For each commodity:
- `avgAskPrice` = mean of `askPrice` across all stations where it's an export (null if no station exports it)
- `avgBidPrice` = mean of `bidPrice` across all stations where it's an import (null if no station imports it)

### API

Add to the `/api/economy/market/:stationId` response:

```typescript
interface MarketListing {
  commodityId: string;
  name: string;
  role: 'export' | 'import';
  stockpile: number;
  target: number;
  available: number;          // availableForSale for exports, maxImportStockpile - stockpile for imports
  price: number;              // askPrice for exports, bidPrice for imports
  basePrice: number;
  systemAvgPrice: number;     // system average for comparison
  trend: 'rising' | 'falling' | 'stable';
  outOfStock: boolean;        // true if export with 0 available
  fullyStocked: boolean;      // true if import at max capacity
}
```

Add a new endpoint or extend existing:

```
GET /api/economy/system-prices/:systemId → SystemAverages
```

This supports the body popup UI (below) which needs system-wide info without querying every station individually.

---

## Cargo Hold Rebalance

### Change

Reduce the starting ship's maximum cargo capacity:

```
DARTER_MASS.maxCargo: 40000 → 8000 (kg)
```

### Rationale

At 40,000 kg with 10,000 CR starting credits, the cargo limit is never the binding constraint — the wallet runs out first. At 8,000 kg, the hold creates genuine tension:

- Bulk hauling (common metals at 5 kg/unit) fills the hold at 1,600 units = 40,000 CR worth. The player must choose between volume and value.
- High-value low-mass cargo (pharmaceuticals at 0.5 kg/unit) fits 16,000 units but costs 3.2M CR — unaffordable early game but aspirational.
- This creates a natural value-density trade-off: fill up cheap and heavy, or carry less of something expensive and light.

Ship upgrades (larger holds) become meaningful progression milestones.

### File Change

In the ship mass constants (referenced as `DARTER_MASS` in `server/src/GameServer.ts` and the shared ship definitions):

```typescript
maxCargo: 8000  // kg, down from 40000
```

Propellant capacity remains at 8,000 kg (range feels right as-is).

---

## UI: At-a-Glance Body Info

### Concept

When a player clicks on a planet, moon, or asteroid in the main system view, the info popup should immediately show what trade opportunities exist at that body's station(s) without requiring the player to dock or open the full market.

### Display Format

Add a "Trade" section to the body info popup:

```
═══ TRADE ═══

▲ Buying:  Food ▲▲  Water ▲  Machine Parts ▲
▼ Selling: Common Metals  Rare Metals  Silicates
```

**"Buying"** = station imports (player can sell here). The arrows indicate demand intensity:
- ▲▲▲ = stockpile below 25% of target (desperate, paying premium)
- ▲▲ = stockpile below 50% of target (strong demand)
- ▲ = stockpile below 75% of target (moderate demand)
- (no arrow) = stockpile near or above target (low demand)

**"Selling"** = station exports (player can buy here). No demand arrows needed — the player just needs to know what's available. Optionally show "Out of Stock" if `availableForSale` is 0.

### Color Coding

- High demand imports (▲▲▲, ▲▲): green text (good place to sell)
- Moderate demand imports (▲): amber/yellow
- Low demand imports: white/grey
- Exports: white/default
- Out of stock exports: dim/grey

### Data Source

The client needs per-body trade summary data without fetching full market listings for every station in the system. Add an endpoint or extend the system data response:

```
GET /api/economy/trade-summary/:systemId
```

Returns for each body with a station:

```typescript
interface BodyTradeSummary {
  bodyId: string;
  stationName: string;
  imports: { commodityId: string; name: string; demandLevel: 0 | 1 | 2 | 3 }[];
  exports: { commodityId: string; name: string; outOfStock: boolean }[];
}
```

This endpoint can be polled on the same 30-second cadence as the economy tick.

---

## UI: Market Panel Updates

When the player docks and opens the full market panel, update the display to reflect the new model:

### Per-Commodity Row

```
[Commodity Name]  [Role Badge]  [Price]  [Sys Avg]  [Stock]  [Trend]  [Action]
```

- **Role Badge**: "BUY" (green, for exports the player can buy) or "SELL" (blue, for imports the player can sell to).
- **Price**: The ask price (for exports) or bid price (for imports).
- **Sys Avg**: System average price for this commodity. Color the station price green if it's a good deal relative to system average, red if not.
  - For exports (player buying): green if station ask < system avg ask (cheap).
  - For imports (player selling): green if station bid > system avg bid (pays well).
- **Stock**: Available quantity. For exports, this is `stockpile - reserve`. For imports, this shows remaining capacity `maxImportStockpile - stockpile`.
- **Trend**: Rising/falling/stable arrow, same as current.
- **Action**: Buy/Sell button. Disabled with tooltip if out of stock, fully stocked, or insufficient credits/cargo space.

### Profit/Loss Indicator

When selling, if the player has a cost basis for the commodity, show projected profit per unit:

```
Bid: 38 CR  |  Your cost: 25 CR  |  Profit: +13 CR/unit (+52%)
```

---

## Migration Summary by File

| File | Changes |
|------|---------|
| `shared/src/economy/commodities.ts` | Add `exports` and `imports` arrays to each archetype definition. Add `RESERVE_HOURS`, `SPREAD_MARGIN`, `PRICE_SMOOTHING` constants. |
| `shared/src/economy/pricing.ts` | Replace `calculatePrice()` with `calculateAskPrice()` and `calculateBidPrice()`. Add spread margin and clamping logic. |
| `shared/src/economy/types.ts` | Add `role` field to commodity state. Add `bidPrice`/`askPrice` to station commodity state. Add `SystemAverages`, `BodyTradeSummary` types. |
| `server/src/economy/EconomySimulator.ts` | Tick interval: wall-clock 30s, scale rates by `elapsedGameHours`. Compute reserves per export commodity. Apply price smoothing. Calculate system averages at end of tick. |
| `server/src/economy/EconomySimulator.ts` | `executeTrade()`: validate commodity role (export for buy, import for sell). Mutate stockpile immediately but do not recalculate prices. |
| `server/src/economy/EconomySimulator.ts` | `getMarketListings()`: return role, bid/ask price, available quantity (minus reserve for exports), system average, out-of-stock/fully-stocked flags. |
| `server/src/routes/economy.ts` | Add `GET /api/economy/trade-summary/:systemId` endpoint. Add `GET /api/economy/system-prices/:systemId` endpoint. Update market listing response shape. |
| `server/src/GameServer.ts` | Update `DARTER_MASS.maxCargo` from 40000 to 8000. |
| `client/src/client/hud/store.ts` | Update cargo/market state types for new listing shape. |
| `client/src/RemoteBridge.ts` | Handle new API response shapes. Add trade summary polling. |
| Client: body info popup | Add trade summary section showing imports (with demand arrows) and exports. |
| Client: market panel | Show role badges, bid/ask prices, system averages, profit/loss indicators, out-of-stock/fully-stocked states. |
