// ── Spectral Classification ──────────────────────────────────────────

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
export type SpecialStarType = 'red_giant' | 'white_dwarf' | 'brown_dwarf' | 'neutron_star' | 't_tauri';
export type LuminosityClass = 'V' | 'III' | 'VII' | 'Ia' | 'Ib';

export interface StarParameters {
  id: string;
  name: string;
  spectralClass: SpectralClass | SpecialStarType;
  spectralSubclass: number;           // 0-9
  luminosityClass: LuminosityClass;
  mass: number;                       // kg
  radius: number;                     // meters
  luminosity: number;                 // watts (bolometric)
  luminositySolar: number;            // in solar luminosities
  surfaceTemperature: number;         // kelvin
  age: number;                        // years
  metallicity: number;                // [Fe/H]
  color: number;                      // hex color for rendering
  mu: number;                         // gravitational parameter m^3/s^2
}

// ── Planet Classification ────────────────────────────────────────────

export type PlanetClass =
  | 'rocky'
  | 'super_earth'
  | 'mini_neptune'
  | 'gas_giant'
  | 'ice_giant'
  | 'dwarf';

export type OrbitalZone = 'hot' | 'habitable' | 'warm' | 'cold' | 'outer';

// ── Magnetic Field ───────────────────────────────────────────────────

export type MagneticFieldStrength = 'none' | 'weak' | 'moderate' | 'strong';

// ── Planet Physical Parameters ───────────────────────────────────────

export interface PlanetPhysicalParams {
  mass: number;                   // kg
  radius: number;                 // meters
  density: number;                // kg/m^3
  surfaceGravity: number;         // m/s^2
  escapeVelocity: number;         // m/s
  orbitalPeriod: number;          // seconds
  rotationPeriod: number;         // seconds
  axialTilt: number;              // degrees
  tidallyLocked: boolean;
  magneticField: MagneticFieldStrength;
  albedo: number;
  equilibriumTemperature: number; // kelvin
  surfaceTemperature: number;     // kelvin
}

// ── Core & Interior ──────────────────────────────────────────────────

export type CoreType = 'iron_nickel' | 'silicate' | 'ice' | 'metallic_hydrogen' | 'none';

export interface MaterialFraction {
  material: string;
  fraction: number;
}

export interface PlanetInterior {
  coreType: CoreType;
  coreComposition: MaterialFraction[];
  mantleComposition: MaterialFraction[];
  coreMassFraction: number;
  differentiated: boolean;
}

// ── Surface ──────────────────────────────────────────────────────────

export type SurfaceType =
  | 'barren_rocky' | 'volcanic' | 'frozen' | 'desert'
  | 'oceanic' | 'terrestrial' | 'greenhouse' | 'carbon'
  | 'lava' | 'ice_rock';

export type VolcanismLevel = 'none' | 'extinct' | 'minor' | 'moderate' | 'extreme';

export interface SurfaceLiquid {
  type: 'water' | 'methane' | 'ethane' | 'ammonia' | 'sulfuric_acid' | 'lava' | 'liquid_nitrogen';
  coverage: number;
  depth: 'shallow' | 'moderate' | 'deep' | 'global_ocean';
}

export interface PlanetSurface {
  hasSolidSurface: boolean;
  crustComposition: MaterialFraction[];
  surfaceType: SurfaceType;
  tectonicallyActive: boolean;
  volcanism: VolcanismLevel;
  surfaceLiquid: SurfaceLiquid | null;
  surfacePressure: number;        // pascals
  surfaceFeatures: string[];
}

// ── Atmosphere ───────────────────────────────────────────────────────

export interface AtmosphericGas {
  gas: string;
  fraction: number;
}

export type AtmosphericHazard =
  | 'toxic' | 'corrosive' | 'extreme_pressure'
  | 'extreme_heat' | 'extreme_cold' | 'radiation' | 'flammable';

export interface PlanetAtmosphere {
  present: boolean;
  surfacePressure: number;        // atmospheres
  scaleHeight: number;            // meters
  composition: AtmosphericGas[];
  hazards: AtmosphericHazard[];
  cloudCover: number;
  cloudType: string | null;
  greenhouseEffect: number;       // kelvin added
  breathable: boolean;
  colorTint: number;              // hex color
}

// ── Biosphere ────────────────────────────────────────────────────────

export type BiosphereComplexity =
  | 'none' | 'prebiotic' | 'microbial'
  | 'simple_multicellular' | 'complex_multicellular' | 'intelligent';

export type BiomassLevel = 'none' | 'trace' | 'sparse' | 'moderate' | 'abundant' | 'extreme';

export type BiomeType =
  | 'microbial_mat' | 'subsurface' | 'aquatic' | 'tidal_zone'
  | 'forest' | 'grassland' | 'desert_adapted' | 'aerial'
  | 'ice_ecosystem' | 'hydrothermal';

export type BiohazardType =
  | 'incompatible_biochemistry' | 'pathogenic' | 'toxic_biome' | 'aggressive_fauna';

export interface PlanetBiosphere {
  present: boolean;
  complexity: BiosphereComplexity;
  biomeTypes: BiomeType[];
  biomass: BiomassLevel;
  oxygenProducing: boolean;
  hazards: BiohazardType[];
  compatibility: number;
}

// ── Rings ────────────────────────────────────────────────────────────

export interface RingSystem {
  present: boolean;
  innerRadius: number;
  outerRadius: number;
  composition: 'ice' | 'rock' | 'mixed';
  opacity: number;
  colorTint: number;
}

// ── Resources ────────────────────────────────────────────────────────

export type ResourceLevel = 'none' | 'trace' | 'poor' | 'moderate' | 'rich' | 'exceptional';

export interface PlanetResources {
  waterAvailability: ResourceLevel;
  rareMetals: ResourceLevel;
  commonMetals: ResourceLevel;
  radioactives: ResourceLevel;
  hydrocarbons: ResourceLevel;
  volatiles: ResourceLevel;
  exotics: ResourceLevel;
}

// ── Asteroid ─────────────────────────────────────────────────────────

export type AsteroidShape = 'spheroidal' | 'elongated' | 'irregular' | 'contact_binary';
export type AsteroidComposition = 'carbonaceous' | 'silicate' | 'metallic' | 'icy';

export interface GeneratedAsteroid {
  id: string;
  name: string;
  designation: number;
  semiMajorAxis: number;
  eccentricity: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  direction: 1 | -1;
  mass: number;
  radius: number;
  density: number;
  rotationPeriod: number;
  shape: AsteroidShape;
  composition: AsteroidComposition;
  resources: PlanetResources;
}

// ── Moon ─────────────────────────────────────────────────────────────

export interface GeneratedMoon {
  id: string;
  name: string;
  designation: string;            // lowercase letter (a, b, c, ...)
  semiMajorAxis: number;
  eccentricity: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  direction: 1 | -1;
  planetClass: PlanetClass;
  physical: PlanetPhysicalParams;
  interior: PlanetInterior;
  surface: PlanetSurface | null;
  atmosphere: PlanetAtmosphere;
  biosphere: PlanetBiosphere;
  resources: PlanetResources;
  tidalHeating: number;
  tidallyLockedToParent: boolean;
  capturedBody: boolean;
}

// ── Planet ────────────────────────────────────────────────────────────

export interface GeneratedPlanet {
  id: string;
  name: string;
  designation: number;
  semiMajorAxis: number;
  eccentricity: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  direction: 1 | -1;
  planetClass: PlanetClass;
  physical: PlanetPhysicalParams;
  interior: PlanetInterior;
  surface: PlanetSurface | null;
  atmosphere: PlanetAtmosphere;
  biosphere: PlanetBiosphere;
  rings: RingSystem | null;
  resources: PlanetResources;
  moons: GeneratedMoon[];
}

// ── System ───────────────────────────────────────────────────────────

export interface GeneratedSystem {
  seed: number;
  star: StarParameters;
  planets: GeneratedPlanet[];
  asteroids: GeneratedAsteroid[];
  systemAge: number;
  habitableZone: { inner: number; outer: number };
  frostLine: number;
}
