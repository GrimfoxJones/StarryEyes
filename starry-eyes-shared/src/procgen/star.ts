import type { SeededRng } from './rng.js';
import type { SpectralClass, SpecialStarType, LuminosityClass, StarParameters } from './types.js';
import { generateStarName } from './naming.js';
import { G } from '../constants.js';

// ── Spectral class data ──────────────────────────────────────────────

interface SpectralClassData {
  tempMin: number; tempMax: number;
  color: number;
  massMin: number; massMax: number;   // solar masses
  radiusMin: number; radiusMax: number; // solar radii
  lumMin: number; lumMax: number;       // solar luminosities
}

const MAIN_SEQUENCE: Record<SpectralClass, SpectralClassData> = {
  O: { tempMin: 30000, tempMax: 50000, color: 0x9BB0FF, massMin: 16, massMax: 150, radiusMin: 6.6, radiusMax: 25, lumMin: 30000, lumMax: 1000000 },
  B: { tempMin: 10000, tempMax: 30000, color: 0xAABFFF, massMin: 2.1, massMax: 16, radiusMin: 1.8, radiusMax: 6.6, lumMin: 25, lumMax: 30000 },
  A: { tempMin: 7500, tempMax: 10000, color: 0xCAD7FF, massMin: 1.4, massMax: 2.1, radiusMin: 1.4, radiusMax: 1.8, lumMin: 5, lumMax: 25 },
  F: { tempMin: 6000, tempMax: 7500, color: 0xF8F7FF, massMin: 1.04, massMax: 1.4, radiusMin: 1.15, radiusMax: 1.4, lumMin: 1.5, lumMax: 5 },
  G: { tempMin: 5200, tempMax: 6000, color: 0xFFF4EA, massMin: 0.8, massMax: 1.04, radiusMin: 0.96, radiusMax: 1.15, lumMin: 0.6, lumMax: 1.5 },
  K: { tempMin: 3700, tempMax: 5200, color: 0xFFD2A1, massMin: 0.45, massMax: 0.8, radiusMin: 0.7, radiusMax: 0.96, lumMin: 0.08, lumMax: 0.6 },
  M: { tempMin: 2400, tempMax: 3700, color: 0xFFB56C, massMin: 0.08, massMax: 0.45, radiusMin: 0.1, radiusMax: 0.7, lumMin: 0.001, lumMax: 0.08 },
};

interface SpecialStarData {
  tempMin: number; tempMax: number;
  color: number;
  massMin: number; massMax: number;
  radiusMin: number; radiusMax: number;
  lumMin: number; lumMax: number;
  luminosityClass: LuminosityClass;
}

const SPECIAL_STARS: Record<SpecialStarType, SpecialStarData> = {
  red_giant:     { tempMin: 3500, tempMax: 5000, color: 0xFF8C42, massMin: 0.8, massMax: 8, radiusMin: 10, radiusMax: 100, lumMin: 100, lumMax: 10000, luminosityClass: 'III' },
  white_dwarf:   { tempMin: 8000, tempMax: 40000, color: 0xE0E8FF, massMin: 0.5, massMax: 1.4, radiusMin: 0.008, radiusMax: 0.02, lumMin: 0.001, lumMax: 0.1, luminosityClass: 'VII' },
  brown_dwarf:   { tempMin: 500, tempMax: 2400, color: 0x8B4513, massMin: 0.01, massMax: 0.08, radiusMin: 0.08, radiusMax: 0.15, lumMin: 0.00001, lumMax: 0.001, luminosityClass: 'V' },
  neutron_star:  { tempMin: 600000, tempMax: 1000000, color: 0xE8E8FF, massMin: 1.1, massMax: 2.1, radiusMin: 0.00001, radiusMax: 0.00002, lumMin: 0.001, lumMax: 10, luminosityClass: 'V' },
  t_tauri:       { tempMin: 3000, tempMax: 5000, color: 0xFFAA55, massMin: 0.2, massMax: 2, radiusMin: 1, radiusMax: 5, lumMin: 0.5, lumMax: 10, luminosityClass: 'V' },
};

// Solar units
const SOLAR_MASS = 1.989e30;    // kg
const SOLAR_RADIUS = 6.96e8;    // m
const SOLAR_LUMINOSITY = 3.828e26; // W

export function generateStar(rng: SeededRng): StarParameters {
  // Decide main sequence vs special (7% special)
  const isSpecial = rng.chance(0.07);

  if (isSpecial) {
    return generateSpecialStar(rng);
  }

  // Main sequence weighted selection
  const classes: SpectralClass[] = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
  const weights = [0.5, 1.5, 3, 8, 15, 25, 40];
  const spectralClass = rng.weighted(classes, weights);

  const data = MAIN_SEQUENCE[spectralClass];
  const subclass = rng.int(0, 9);

  // Interpolate within class range using subclass
  const t = (subclass + rng.next()) / 10;

  const massSolar = lerp(data.massMax, data.massMin, t); // higher subclass = cooler = lower mass
  const radiusSolar = lerp(data.radiusMax, data.radiusMin, t);
  const lumSolar = lerpLog(data.lumMax, data.lumMin, t);
  const temp = lerp(data.tempMax, data.tempMin, t);

  const mass = massSolar * SOLAR_MASS;
  const radius = radiusSolar * SOLAR_RADIUS;
  const luminosity = lumSolar * SOLAR_LUMINOSITY;

  // Age: depends on main sequence lifetime
  const msLifetime = 1e10 * Math.pow(massSolar, -2.5);
  const age = rng.range(0.1, 0.95) * msLifetime;

  const metallicity = rng.range(-0.5, 0.5);
  const name = generateStarName(rng);

  return {
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    spectralClass,
    spectralSubclass: subclass,
    luminosityClass: 'V',
    mass,
    radius,
    luminosity,
    luminositySolar: lumSolar,
    surfaceTemperature: temp,
    age,
    metallicity,
    color: data.color,
    mu: G * mass,
  };
}

function generateSpecialStar(rng: SeededRng): StarParameters {
  const types: SpecialStarType[] = ['red_giant', 'white_dwarf', 'brown_dwarf', 'neutron_star', 't_tauri'];
  const weights = [2.5, 2, 1.5, 0.5, 0.5];
  const starType = rng.weighted(types, weights);

  const data = SPECIAL_STARS[starType];
  const t = rng.next();

  const massSolar = lerp(data.massMin, data.massMax, t);
  const radiusSolar = lerp(data.radiusMin, data.radiusMax, t);
  const lumSolar = lerpLog(data.lumMin, data.lumMax, t);
  const temp = lerp(data.tempMin, data.tempMax, t);

  const mass = massSolar * SOLAR_MASS;
  const radius = radiusSolar * SOLAR_RADIUS;
  const luminosity = lumSolar * SOLAR_LUMINOSITY;

  const age = starType === 't_tauri'
    ? rng.range(1e5, 1e7)
    : rng.range(1e9, 1e10);

  const metallicity = rng.range(-0.5, 0.5);
  const name = generateStarName(rng);

  return {
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    spectralClass: starType,
    spectralSubclass: rng.int(0, 9),
    luminosityClass: data.luminosityClass,
    mass,
    radius,
    luminosity,
    luminositySolar: lumSolar,
    surfaceTemperature: temp,
    age,
    metallicity,
    color: data.color,
    mu: G * mass,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpLog(a: number, b: number, t: number): number {
  if (a <= 0 || b <= 0) return lerp(a, b, t);
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
}
