# StarryEyes — Economy System Design Notes

**Project:** StarryEyes (Working Title)
**Studio:** Grimfox Games
**Phase:** Pre-Production — Economy Design (Phase 3)
**Date:** March 2026

---

## Overview

The economy system targets Phase 3, layering on top of the flight simulation established in Phase 1 and the multiplayer infrastructure of Phase 2. The design prioritises emergent complexity from simple rules — depth comes from the web of commodity dependencies, not from complicated pricing mechanics.

---

## Core Principles

- **Stockpile-driven pricing.** Each station holds an inventory of each commodity with a target stockpile level. Price is a function of how far below or above target the station currently sits. Low stock = high price, high stock = low price.
- **No hidden systems.** No global supply curves, no auction mechanics. Players read the market directly.
- **Transparent live prices.** Price information travels at the speed of light. All station prices are visible system-wide at all times. Players can see opportunities but cannot lock in a price — you race to execute before the market shifts or another player gets there first.
- **Geography matters.** Commodity sources are location-locked. The orbital positions of bodies and the distances between them are intrinsic market mechanics — a body on the far side of the system costs more in transit time to reach, which widens price differentials.
- **Water is the universal resource.** Ships carry water tanks and crack on demand — oxygen for life support, hydrogen as reaction mass for thrust, deuterium skimmed continuously for the fusion reactor. With high-ISP reactionless drives, water consumption per transit is very low. Water scarcity is nonetheless a system-level variable in procgen systems; an H2O-poor system is a fundamentally different and more dangerous economic environment.

---

## Production Model

Commodities flow from extraction facilities through to finished goods. Fixed facilities handle their own internal processing — a water extraction facility produces Water directly from ice deposits; the purification step is internal and invisible to the economy. The distinction between extraction and refinement is not player-facing at this stage. What matters is the dependency graph: what each commodity requires as inputs, and what consumes it as output.

**Facility tiers:** Facilities come in low and high efficiency variants. Same inputs, better output ratio at the high end. This is the primary progression and investment lever for stations.

**Storage caps:** Facilities have both a throughput rate and a storage cap. A facility at storage cap stops producing until its stockpile is cleared. This prevents runaway accumulation during player absence and keeps prices from flattening permanently. Clearing a backed-up stockpile is time-sensitive and creates trade opportunity.

**The "Ore" concept** — raw extracted material with a variable compositional profile requiring separate processing — is reserved for a future player-driven mining phase. Ice, for example, is essentially water-rich ore; a permanent ice mining facility abstracts this into Water as its output. It has no place in Phase 3's fixed-facility economy.

---

## Pricing Model

Price is determined by a per-commodity exponent applied to the stockpile deviation from target. Linear by default (exponent = 1), but tunable per commodity where the market dynamics warrant a steeper or shallower curve. Water in an H2O-poor system likely wants a steeper curve than iron in a belt-rich system.

---

## Ship Drives & Water Consumption

Ships use high-ISP reactionless drives — approximately 20,000 seconds specific impulse as a point of reference. These are sci-fi drives that do most of the propulsive work without reaction mass; a small water exhaust is required but consumption per transit is very low. Players will not be anxiously watching a water gauge on routine runs. Water scarcity is a structural economic concern rather than a moment-to-moment resource management mechanic.

---

## Commodity List

### Extracted Commodities

Produced at fixed extraction facilities. Location-locked by geology and orbital zone.

| Commodity | Primary Source |
|-----------|---------------|
| Water | Permanent ice extraction facilities (outer moons, ice-bearing bodies) |
| Iron | S-type and M-type asteroids, rocky bodies |
| Copper | M-type asteroids (rarer) |
| Titanium | S-type asteroids (rarer deposits) |
| Silicates | S-type asteroids, rocky moons |
| Carbon | C-type asteroids (outer belt), inner planets |

### Manufactured Commodities

Produced at stations with appropriate industrial facilities. Consumes inputs at fixed ratios.

| Output | Inputs | Primary Sink |
|--------|--------|--------------|
| Polysilicon | Silicates | Electronics, solar panels |
| Polymers | Carbon | Seals, life support components |
| Fertilizer | Carbon + Water | Food production |
| Electronics | Copper + Polysilicon | Machine parts, weapons, ship systems |
| Machine Parts | Iron + Electronics | Stations, ship maintenance |
| Hull Plates | Iron + Titanium | Shipyards |
| Food | Water + Fertilizer + Sunlight | Population |
| Weapons | Iron + Electronics | Military bases |

### Geographic Notes

- **Sunlight as food input** means inner system stations are natural food producers and outer system stations are perpetually food-dependent. Gas giant moons import food indefinitely — a long route with a guaranteed sink.
- **Water availability** is highest in the outer system around ice-bearing bodies. Inner system stations dependent on imported water trade food for it; outer system stations trade water for food. Each needs what the other naturally produces.
- **Water scarcity as a system variable.** In procgen systems, H2O abundance is a top-level differentiator. An ice-poor system means constrained life support, expensive agriculture, and limited drive operation on long transits. Players who control water sources in a dry system hold structural economic power.
- **Ice purification byproducts.** Ice bodies are not pure water — they are mixtures of water ice, CO2, ammonia, methane clathrates, silicate dust, and complex organics. The internal purification process at a water extraction facility produces non-trivial byproduct yields of carbon compounds and silicates. These can be traded as secondary outputs or vented. Mechanic is noted for future use; keep it simple for now.

### Asteroid Taxonomy

Real asteroid types map cleanly onto the commodity list. Procgen systems should distribute asteroid types by orbital zone:

| Type | Zone | Primary Commodities | Notes |
|------|------|---------------------|-------|
| C-type (carbonaceous) | Outer belt | Carbon, trace Water (hydrated minerals) | Most common — ~75% of all asteroids. Dark, low-albedo. Ryugu and Bennu are real-world examples. |
| S-type (silicaceous) | Inner belt | Silicates, Iron, Titanium | Brighter bodies. Primary metal and silicate source. |
| M-type (metallic) | Sparse, any zone | Copper, Iron (high concentration) | Thought to be exposed cores of differentiated bodies. Rare, very high value. |

Procgen should weight C-types toward the outer belt and S-types toward the inner belt, with M-types as rare finds anywhere. This gives asteroid prospecting genuine depth — players are looking for the right *type* of body, not just any asteroid.

### Future Commodity Expansion

Precious and specialist metals — gold, silver, platinum-group metals (platinum, palladium, iridium), magnesium, aluminium — are scientifically plausible and economically interesting but not needed in Phase 3. When added they fit as M-type exclusives (gold, platinum-group) or common silicate byproducts (magnesium, aluminium), and slot naturally as quality-tier inputs rather than replacements. Basic hull plates use Iron, premium variants add Titanium, cutting-edge variants might use magnesium-aluminium composites. Advanced electronics add Silver or Gold. Top-tier reactor and thruster components need platinum-group metals.

---

## Demand & Sinks

### Station Archetypes

Each station type has a distinct consumption profile. Players can look at a station and predict what it needs.

| Archetype | High Demand | Low Demand |
|-----------|-------------|------------|
| Mining Outpost | Water, Food, Machine Parts | Weapons, Electronics |
| Habitat Colony | Food, Water, Electronics, Machine Parts | Weapons |
| Water Depot | Water (from ice extraction) | Food, Machine Parts |
| Military Base | Water, Machine Parts, Weapons | Electronics |
| Shipyard | Hull Plates, Machine Parts, Electronics | Food |
| Weapon Factory | Iron, Electronics | Food |

### Industrial Consumption

Production chains consume inputs permanently. An extraction facility burning through raw inputs is a sink. A water depot processing ice deposits is a sink. These scale with production throughput, which scales with how well-supplied the station is. A well-supplied facility is both a stronger sink for its inputs and a stronger source of its outputs.

---

## Population System

### Phase 3 Implementation

Population is a single slow-moving number that acts as a demand multiplier. It has a floor — stations do not die in Phase 3, they get hungry and expensive. Population drifts upward when supply is consistently good and downward when it is not.

```
populationGrowthRate = baseBirthRate
                     - baseDeathRate
                     + (supplyScore * immigrationMultiplier)
                     - (overcrowdingFactor * emigrationMultiplier)
```

`supplyScore` is a rolling average of how consistently the station has received its needed commodities over the last N game-days. This single number drives population trajectory.

### Future Population Layers (Post Phase 3)

The intent is to simulate population fully — birth rates, death rates, immigration, emigration. The framework below should be kept in mind when building Phase 3 so the upgrade path is clean.

- **Migration pressure model.** Each station has a net migration pressure — positive (people want to leave) or negative (people want to arrive). Driven by supply score, prosperity, population density vs. capacity, and discrete events (accidents, disease outbreaks).
- **People as a commodity.** Colonist transport becomes a gameplay layer. Passenger liners match emigration supply at struggling stations to immigration demand at growing ones. Directionality is a design problem unique to people — iron doesn't have a preferred destination.
- **Corporate dynamics.** Corporations can hire or lay off workers at stations, creating demand spikes and emigration pressure independent of supply conditions.
- **Ghost stations.** If a station falls below a minimum viable population threshold it collapses. Infrastructure remains intact, population evacuates. Derelict stations can be re-seeded by players or corporations — a frontier colony-building gameplay loop.

---

## Player Role — The Merchant Prince Model

Players are not pilots. They are merchant captains commanding a fleet of ships, each with its own crew. The core loop is identifying opportunities, directing ships, and choosing when to take the helm personally for maximum return.

### Captain AI

Ship captains execute a simple instruction queue deterministically. The queue is a player-authored script:

```
TRANSIT TO: Vesta Station
SELL: Food (all)
BUY: Iron (100 units)
TRANSIT TO: Inner Colony 1
SELL: Iron (all)
WAIT FOR INSTRUCTIONS
```

No branching, no conditions. When the queue runs out the captain holds position and waits.

**Efficiency penalty:** Captains operate at 80% efficiency — they buy at 110% of current market price and sell at 90%. The trade executes but not at the best available terms. This is a price modifier, not a quantity modifier, so the math is transparent to players.

**Captain's log field:** Each queue instruction supports a freetext note field. No mechanical effect. Provides context when reviewing a captain's actions days later.

### Active Play Bonus

When a player is actively directing a ship they execute trades at full efficiency and can react to live price data mid-transit. The captain AI sets a floor on ship performance. Player skill sets the ceiling.

The active play reward is not punishment-avoidance — it is opportunity capture. A captain won't spot that a facility just had an accident and is paying triple for machine parts for the next two game-weeks. A player checking the market will.

### Multi-Ship Progression

Players build a fleet over time. Active attention goes to the highest-value opportunity. Automated ships handle routine routes. Transit times become anticipation rather than dead time — the player is managing a growing operation, not waiting for one ship.

---

## Clock & Economy Tick Rate

The physics simulation clock and the economy tick rate are independent. The physics clock runs at whatever rate makes flight feel right. Production cycles, population drift, and price updates can batch on a much slower cadence — every game-hour rather than every game-second. Players won't notice. Overnight economic drift is dramatically reduced without affecting flight feel.

---

## Design Constraints & Guardrails

- **Sinks should feel like appetite, not taxation.** Forced commodity drains (mandatory ship maintenance costs) create friction without decisions. Optional sinks that reward engagement (machine parts enabling throughput upgrades) are preferred.
- **No category substitution system.** Commodities are themselves. Industrial consumers want specific inputs — an iron facility does not want copper. The price variation that substitution would provide is handled naturally by individual stockpile pricing.
- **Automation has a ceiling.** Ships execute queued routes and then wait. Full passive automation is intentionally limited so active play remains meaningful. The answer to "why bother logging in" is opportunity capture, not mandatory engagement.

---

## Procedural Settlement System

Star systems are procedurally generated and their economic development is determined algorithmically from their physical characteristics and distance from the prime system (ID 0). Settlement level is computed deterministically from three cascading scores — no runtime randomness beyond what procgen already provides.

### Score 1: Remoteness

Derived from system ID alone. Exponential decay with a long tail — drops off fast near prime but never fully reaches zero, so an exceptional system far out will still have some presence.

```
remoteness = 1 - e^(-k * systemId)    // k ≈ 0.003
```

Output: 0.0 (prime) → approaches 1.0 (fully remote).

### Score 2: Resource Diversity

Rewards balanced multi-resource systems over single-resource bonanzas. Aggregates the best resource rating per category across all bodies in the system, then applies a square root per category before summing. The square root is the key tuning knob — it means six moderate resources scores better than one exceptional resource.

Active categories for Phase 3: `waterAvailability`, `commonMetals`, `rareMetals`, `silicates`, `carbon`.

### Score 3: Habitability Bonus

A flat additive bonus when truly habitable bodies are present. Breathable atmosphere is the baseline (+0.4). Liquid water surface adds more (+0.2). Complex multicellular biosphere adds more again (+0.2). These worlds are rare enough that when they exist they dominate the settlement score regardless of other factors.

### Combined Settlement Score

```
baseScore = (resourceDiversity * 0.5) + (habitabilityBonus * 0.5)
settlementScore = baseScore * (1 - remoteness * 0.8)
```

The 0.8 remoteness weight means even a fully remote system retains 20% of its base score.

### Settlement Levels

| Score | Level | Description |
|-------|-------|-------------|
| < 0.05 | Unexplored | No permanent presence |
| 0.05–0.20 | Surveyed | Scientific or prospecting outpost only |
| 0.20–0.40 | Outpost | Early resource extraction underway |
| 0.40–0.60 | Settled | Functioning multi-commodity economy |
| 0.60–0.80 | Developed | Full station archetype range, growing population |
| > 0.80 | Prime | Dense station network, high population, established trade lanes |

### Station Presence by Settlement Level

| Level | Station Types Spawned |
|-------|----------------------|
| Unexplored | None |
| Surveyed | 1 small mining outpost near best resource body |
| Outpost | 2–3 mining outposts, 1 water depot |
| Settled | Full commodity range, 1 habitat colony, basic shipyard |
| Developed | All archetypes, multiple habitat colonies, weapon factory |
| Prime | Dense networks, military bases, multiple shipyards |

Station placement follows resource ratings on individual bodies — a mining outpost goes on the body with the highest relevant resource rating, not randomly assigned.

### Initial Economic State

When a system is first instantiated, starting stockpile levels are seeded from the settlement level so players entering a developed system find a functioning economy rather than empty shelves.

| Level | Starting Stockpile Fraction |
|-------|----------------------------|
| Surveyed | 20% of target — skeletal, high prices |
| Outpost | 40% |
| Settled | 60% |
| Developed | 75% |
| Prime | 90% — well-stocked, competitive prices |

Starting population follows the same pattern — surveyed systems have skeleton crews, prime systems have established populations near carrying capacity.

### Tuning Notes

All score thresholds and formula weights are first-pass estimates. The structure is correct; the specific numbers are playtesting targets. The settlement level cutoffs, the remoteness decay constant `k`, and the 0.8 remoteness weight are the primary levers. See the companion procgen changes document for implementation details.

---

## Open Questions

- Production recipe ratios — specific input/output numbers per facility type, to be tuned during balancing.
- Station throughput and storage caps — tuned by feel during playtesting.
- Price curve exponents — linear by default, custom per commodity where warranted. Specific values to be determined during balancing.
- **Water consumption rates** — how much water does a ship burn per transit? High-ISP drives mean consumption is low, but the exact figure needs tuning so water feels meaningfully scarce in dry systems without being punishing elsewhere.
- **Weapons in Phase 3** — weapon factories produce, military bases consume. Sink is functional without combat. Combat will expand this significantly in a later phase.
