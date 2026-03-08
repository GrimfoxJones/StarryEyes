# StarryEyes: Colonies, Stations & Economy

Technical reference for procedural colony/station generation and the economy simulation as currently implemented.

---

## Table of Contents

1. [System Generation Pipeline](#system-generation-pipeline)
2. [Settlement Scoring](#settlement-scoring)
3. [Settled Bodies (Colonies)](#settled-bodies-colonies)
4. [Station Generation](#station-generation)
5. [Economy: Commodities & Recipes](#economy-commodities--recipes)
6. [Economy: Station Archetypes](#economy-station-archetypes)
7. [Economy Simulation (Server)](#economy-simulation-server)
8. [Pricing Model](#pricing-model)
9. [Player Economy (Credits, Cargo, Trading)](#player-economy)
10. [Refueling](#refueling)
11. [Key Files](#key-files)

---

## System Generation Pipeline

**Entry point:** `generateSystem(seed, systemIndex)` in `shared/src/procgen/system.ts`

The pipeline runs in order:

1. **Star** -- spectral class, mass, radius, luminosity, temperature, age, metallicity
2. **Habitable zone & frost line** -- derived from stellar luminosity
3. **Planets** -- count, orbital elements, class, physical/atmosphere/surface/biosphere/resources
4. **Asteroids** -- belt placement relative to frost line and planet orbits
5. **Settlement scoring** -- composite score from resources, habitability, and remoteness
6. **Settled bodies** -- planets/moons with surface populations (gravity-filtered)
7. **Stations** -- assigned to bodies based on settlement level and archetype scoring
8. **Jump gate** -- orbital radius derived from luminosity, nudged away from planets

All generation is deterministic from the seed. A separate RNG (`seed + 77777`) is used for station generation so station placement doesn't change when unrelated systems are modified.

---

## Settlement Scoring

**File:** `shared/src/procgen/settlement.ts` -- `computeSettlement(system, systemIndex)`

The settlement score determines how developed a star system is. It combines three factors:

### Remoteness (from `systemIndex`)

```
remoteness = 1 - exp(-0.003 * systemIndex)
```

Systems with higher indices are more remote (0 = core, approaching 1 = frontier). Remoteness reduces the final score by up to 80%.

### Resource Diversity

For each of 5 active resources (`water`, `commonMetals`, `rareMetals`, `silicates`, `carbon`), the system-wide maximum level is found across all bodies. Resource levels map to numeric scores:

| Level       | Score |
|-------------|-------|
| none        | 0.0   |
| trace       | 0.1   |
| poor        | 0.3   |
| moderate    | 0.6   |
| rich        | 0.85  |
| exceptional | 1.0   |

Diversity = average of `sqrt(maxLevel)` across the 5 resources.

### Habitability Bonus

Scans all planets and moons:
- Breathable atmosphere: +0.4
- Oceanic or terrestrial surface: +0.2
- Complex multicellular biosphere: +0.2 (simple: +0.1)
- Capped at 1.0

### Combined Score & Level

```
baseScore = (resourceDiversity * 0.5) + (habitability * 0.5)
score     = baseScore * (1 - remoteness * 0.8)
```

| Score   | Settlement Level |
|---------|-----------------|
| >= 0.80 | prime           |
| >= 0.60 | developed       |
| >= 0.40 | settled         |
| >= 0.20 | outpost         |
| >= 0.05 | surveyed        |
| < 0.05  | unexplored      |

---

## Settled Bodies (Colonies)

**File:** `shared/src/procgen/settlement.ts` -- `computeSettledBodies(system)`

A body qualifies as "settled" (has a surface population) if:
- It is a planet or a moon with mass >= 1e21 kg
- Surface gravity is between 0.2g and 1.5g
- It has a solid surface

### Habitability Score (per body)

Composite of 5 weighted factors:

| Factor              | Weight | Calculation                                        |
|---------------------|--------|----------------------------------------------------|
| Gravity             | 25%    | Bell curve peaking at 1.0g, width 0.5g             |
| Breathable atmo     | 35%    | Binary (1 if breathable, 0 otherwise)              |
| Temperature         | 15%    | Deviation from 288K, falls to 0 at +/-100K         |
| Water coverage      | 10%    | Ideal at 70% surface liquid water                  |
| Biosphere           | 15%    | Scale from none (0) to intelligent (0.15/0.15 = 1) |

### Surface Population

- **Breathable atmosphere:** 50,000 to 50,000,000 (exponential scaling by habitability)
- **Non-breathable (dome colonies):** 2,000 to 15,000 (linear scaling)

Settled bodies automatically receive an orbital `habitat_colony` station with population = max(base, 5% of surface pop).

---

## Station Generation

**File:** `shared/src/procgen/stations.ts` -- `generateStations(rng, system, settlement, settledBodies)`

Station generation runs in two phases:

### Phase 1: Settled Body Stations (Guaranteed)

Every settled body gets an orbital `habitat_colony` station. Population is the greater of the archetype base population (500) or 5% of the surface population.

### Phase 2: Resource-Based Stations

The number of additional stations depends on settlement level:

| Level       | Min | Max |
|-------------|-----|-----|
| unexplored  | 0   | 0   |
| surveyed    | 1   | 1   |
| outpost     | 2   | 3   |
| settled     | 3   | 5   |
| developed   | 4   | 7   |
| prime       | 6   | 9   |

### Archetype Selection Pool

Each settlement level has a weighted pool of archetypes (more developed = more variety):

- **surveyed:** mining_outpost
- **outpost:** mining_outpost (x2), water_depot
- **settled:** mining_outpost (x2), water_depot, habitat_colony, shipyard
- **developed:** mining_outpost (x2), water_depot, habitat_colony, shipyard, military_base, weapon_factory
- **prime:** mining_outpost, water_depot (x2), habitat_colony (x2), shipyard, military_base, weapon_factory

### Body Selection (Scoring)

Each archetype uses a different scoring function to pick the best available body:

| Archetype       | Scoring Criteria                                          |
|-----------------|----------------------------------------------------------|
| mining_outpost  | Highest `commonMetals + rareMetals` resource score       |
| water_depot     | Highest `waterAvailability` resource score               |
| habitat_colony  | Breathable atmo (+2), habitable zone (+1.5), water (+0.5)|
| shipyard        | Largest body by mass (log10)                             |
| weapon_factory  | Largest body by mass (log10)                             |
| military_base   | Largest body by mass (log10)                             |

All orbital candidates receive a **gravity penalty**: no penalty below 1.5g, linear decay to 0 at 4g.

### Station Kind

- **Planets and large moons (>1e21 kg):** `orbital` stations
- **Small moons and asteroids:** `ground` bases

### Station Naming

Format: `{bodyName} {archetypeLabel}` where the label adapts to the station kind (e.g., "Station" for orbital, "Base" for ground).

---

## Economy: Commodities & Recipes

**File:** `shared/src/economy/commodities.ts`

### 14 Commodities

#### Extracted (raw resources)

| ID             | Name          | Mass/unit | Base Price |
|----------------|---------------|-----------|------------|
| water          | Water         | 1 kg      | 10 CR      |
| common_metals  | Common Metals | 5 kg      | 25 CR      |
| rare_metals    | Rare Metals   | 3 kg      | 120 CR     |
| silicates      | Silicates     | 4 kg      | 15 CR      |
| carbon         | Carbon        | 2 kg      | 20 CR      |
| volatiles      | Volatiles     | 1 kg      | 30 CR      |

#### Manufactured (crafted from inputs)

| ID               | Name            | Mass/unit | Base Price |
|------------------|-----------------|-----------|------------|
| food             | Food            | 1 kg      | 40 CR      |
| fuel             | Fuel            | 2 kg      | 35 CR      |
| machine_parts    | Machine Parts   | 8 kg      | 80 CR      |
| electronics      | Electronics     | 2 kg      | 150 CR     |
| composites       | Composites      | 3 kg      | 60 CR      |
| pharmaceuticals  | Pharmaceuticals | 0.5 kg    | 200 CR     |
| weapons          | Weapons         | 5 kg      | 250 CR     |
| ship_components  | Ship Components | 10 kg     | 300 CR     |

### Manufacturing Recipes

| Output           | Inputs                        | Rate/hour |
|------------------|-------------------------------|-----------|
| Food             | 1 Water                       | 20        |
| Fuel             | 1 Volatiles                   | 15        |
| Machine Parts    | 1 Common Metals               | 10        |
| Electronics      | 1 Rare Metals + 1 Silicates   | 5         |
| Composites       | 1 Silicates + 1 Carbon        | 12        |
| Pharmaceuticals  | 1 Water + 1 Carbon            | 4         |
| Weapons          | 1 Common Metals + 1 Electronics| 3        |
| Ship Components  | 1 Common Metals + 1 Machine Parts | 2     |

---

## Economy: Station Archetypes

**File:** `shared/src/economy/commodities.ts`

Each archetype defines facilities (what the station produces) and a consumption profile (what it needs).

### Mining Outpost
- **Facilities:** Common Metals (high, cap 800), Rare Metals (low, cap 400), Silicates (low, cap 600)
- **Consumes:** Food 5/hr, Water 8/hr, Machine Parts 1/hr
- **Population:** 50 base, 200 cap

### Habitat Colony
- **Facilities:** Food manufacturing (high, cap 1000), Pharmaceuticals manufacturing (low, cap 200)
- **Consumes:** Water 15/hr, Machine Parts 2/hr, Electronics 1/hr
- **Population:** 500 base, 5000 cap

### Water Depot
- **Facilities:** Water extraction (high, cap 2000), Fuel manufacturing (low, cap 500)
- **Consumes:** Food 8/hr, Machine Parts 1/hr
- **Population:** 80 base, 300 cap

### Military Base
- **Facilities:** Weapons manufacturing (high, cap 400), Composites manufacturing (low, cap 300)
- **Consumes:** Food 12/hr, Water 10/hr, Fuel 5/hr, Machine Parts 3/hr, Electronics 2/hr
- **Population:** 200 base, 1000 cap

### Shipyard
- **Facilities:** Ship Components manufacturing (high, cap 200), Machine Parts manufacturing (high, cap 500)
- **Consumes:** Food 10/hr, Water 8/hr, Common Metals 10/hr, Rare Metals 3/hr, Electronics 5/hr
- **Population:** 300 base, 2000 cap

### Weapon Factory
- **Facilities:** Weapons manufacturing (high, cap 500), Electronics manufacturing (low, cap 300)
- **Consumes:** Food 8/hr, Water 6/hr, Common Metals 8/hr, Machine Parts 2/hr
- **Population:** 150 base, 800 cap

---

## Economy Simulation (Server)

**File:** `server/src/economy/EconomySimulator.ts`

The `EconomySimulator` runs per-system on the server. One instance is created for each star system that has stations. It ticks once per game-hour (3600 game-seconds).

### Initialization

Each station's stockpiles are pre-filled based on the system's settlement level:

| Settlement Level | Initial Fill Fraction |
|------------------|-----------------------|
| unexplored       | 0%                    |
| surveyed         | 20%                   |
| outpost          | 40%                   |
| settled          | 60%                   |
| developed        | 75%                   |
| prime            | 90%                   |

**Targets** are set from two sources:
- Consumption profile rates * 24 (one day buffer)
- Facility storage caps (whichever is higher)

### Tick Cycle (per game-hour)

Each tick runs these steps for every station:

1. **Extraction** -- Extraction facilities produce resources (high tier: 20/hr, low tier: 10/hr), capped at facility storage
2. **Manufacturing** -- Manufacturing facilities consume inputs and produce outputs according to recipes, scaled by efficiency tier (high = 1.5x recipe rate). Limited by available input stockpiles.
3. **Sunlight bonus** -- Habitat colonies get bonus food production scaled by distance from star (inverse-square law, full output at habitable zone distance)
4. **Population consumption** -- Food and water consumed proportional to effective population (station + surface pop). Log-scaled for large populations: `popFactor = log10(pop) * (pop / 10000)` for pop > 10000.
5. **Maintenance** -- Machine parts consumed at 0.5/hr universally
6. **Consumption profile** -- Each archetype's specific consumption rates are applied
7. **Population growth** -- `supplyScore = fraction of tracked commodities above 50% target`. Population drifts toward `supplyScore * populationCap` at 1%/hr. Cannot drop below 50% of base population.
8. **Price update** -- All prices recalculated from current stockpile/target ratios

### Market Listings

`getMarketListings(bodyId)` returns all commodities with non-zero target or stockpile, including:
- Current stockpile (rounded)
- Target level
- Current price
- Base price (for comparison)
- Trend: `rising` (stockpile decreasing), `falling` (stockpile increasing), or `stable`

### Trade Execution

`executeTrade(bodyId, commodityId, quantity, isBuy)`:
- **Buy:** Validates stock availability, removes from station stockpile
- **Sell:** Adds to station stockpile
- Prices update immediately after trade
- Returns `TradeResult` with unit price and total cost

---

## Pricing Model

**File:** `shared/src/economy/pricing.ts`

```
price = basePrice * (target / stockpile) ^ exponent
```

- Clamped to range: `[0.1x basePrice, 10x basePrice]`
- When stockpile < target: price rises (scarcity)
- When stockpile > target: price falls (surplus)
- Default exponent: 1 (linear response)

### Sunlight Factor (for habitat colony food bonus)

```
sunlightFactor = min(1, (habitableDistance / distFromStar)^2)
```

Where `habitableDistance = sqrt(starLuminositySolar) * AU`. Full bonus at habitable zone, inverse-square falloff beyond.

---

## Player Economy

**File:** `server/src/GameServer.ts`, `server/src/routes/economy.ts`

### Starting State

- **Credits:** 10,000 CR per player
- **Cargo:** Empty manifest
- **Cost basis:** Empty (no purchases yet)
- **Max cargo:** 40,000 kg (from `DARTER_MASS.maxCargo`)

### Trading Flow

**Buy:**
1. Validate cargo capacity (commodity mass * quantity must fit)
2. Validate player credits >= total price
3. Validate station stockpile >= requested quantity
4. Deduct from station stockpile (via `EconomySimulator.executeTrade`)
5. Deduct credits from player
6. Update cost basis: `newAvg = (oldAvg * oldQty + unitPrice * qty) / (oldQty + qty)`
7. Add to player cargo

**Sell:**
1. Validate player has sufficient quantity in cargo
2. Add to station stockpile
3. Add credits to player
4. Reduce cargo quantity (if zero, delete entry and cost basis)

### REST Endpoints (`/api/economy/`)

| Method | Path              | Description                                      |
|--------|-------------------|--------------------------------------------------|
| GET    | `/market/:stationId` | Get market listings for a station              |
| POST   | `/buy`            | Buy commodity (body: stationId, commodityId, qty)|
| POST   | `/sell`           | Sell commodity (body: stationId, commodityId, qty)|
| POST   | `/refuel`         | Buy propellant (body: amount in kg)              |
| GET    | `/cargo`          | Get player cargo, credits, cost basis, cargo mass|

All endpoints require auth token.

### Client-Side

- **Store** (`client/src/client/hud/store.ts`): Tracks `credits`, `costBasis`, `cargoManifest`, `cargoMass`, `maxCargo`
- **RemoteBridge** (`client/src/RemoteBridge.ts`): `fetchCargo()` syncs credits/costBasis from server, `executeTrade()` calls buy/sell then refreshes cargo

---

## Refueling

**File:** `server/src/GameServer.ts` -- `processRefuel()`

- **Price:** 5 CR per kg of propellant (hydrogen reaction mass)
- **Requires:** Ship must be orbiting a body with a station (`ship.orbitBodyId` must match a station)
- **Partial fills:** If the player can't afford the full amount, they get as much as they can afford
- **Tank cap:** `DARTER_MASS.maxPropellant` (ship's maximum propellant capacity)
- **Client UI:** Three preset options -- +25%, +50%, FILL -- with kg amounts and CR costs displayed

---

## Key Files

| Path | Purpose |
|------|---------|
| `shared/src/procgen/system.ts` | Top-level `generateSystem()`, `systemToBodies()`, `findStartingBody()` |
| `shared/src/procgen/settlement.ts` | Settlement scoring, settled body computation, initial stockpile fractions |
| `shared/src/procgen/stations.ts` | Station generation (archetype assignment, body selection) |
| `shared/src/procgen/resources.ts` | Resource level generation per planet class and asteroid composition |
| `shared/src/procgen/naming.ts` | Name generation (stars, planets, moons, asteroids) |
| `shared/src/procgen/types.ts` | All procgen type definitions |
| `shared/src/economy/types.ts` | Economy type definitions (commodities, stations, trade, cargo) |
| `shared/src/economy/commodities.ts` | Commodity defs, recipes, archetype defs |
| `shared/src/economy/pricing.ts` | Price calculation formula, sunlight factor |
| `server/src/economy/EconomySimulator.ts` | Server-side economy tick loop |
| `server/src/GameServer.ts` | Player credits, cargo, cost basis, trade/refuel processing |
| `server/src/routes/economy.ts` | REST API endpoints for market, buy, sell, refuel, cargo |
