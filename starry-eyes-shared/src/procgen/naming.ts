import type { SeededRng } from './rng.js';

const PREFIXES = [
  'Al', 'Ar', 'Ash', 'Be', 'Bor', 'Cal', 'Cas', 'Cel', 'Cor', 'Cyr',
  'Da', 'Den', 'Dr', 'El', 'Er', 'Fa', 'Fen', 'Ga', 'Gr', 'Ha',
  'Hel', 'Hy', 'Ir', 'Ka', 'Kel', 'Kyr', 'La', 'Lor', 'Lu', 'Ma',
  'Mar', 'Mel', 'Mir', 'Mor', 'Na', 'Neb', 'No', 'Ol', 'Or', 'Pa',
  'Per', 'Pho', 'Pol', 'Ra', 'Ren', 'Ri', 'Ro', 'Sa', 'Sel', 'Si',
  'Sol', 'Sor', 'Ta', 'Tel', 'Th', 'Tor', 'Ty', 'Ul', 'Va', 'Ve',
  'Vi', 'Vol', 'Xe', 'Za', 'Zel', 'Zo',
];

const MIDDLES = [
  '', '', '', '', // empty is common — short names
  'an', 'ar', 'el', 'en', 'er', 'ia', 'il', 'in', 'ir', 'is',
  'on', 'or', 'os', 'ra', 'ri', 'ta', 'th', 'ul', 'un', 'us',
];

const SUFFIXES = [
  '', 'a', 'an', 'ar', 'as', 'ax', 'ea', 'el', 'en', 'enn',
  'er', 'es', 'ia', 'il', 'in', 'ion', 'ir', 'is', 'ix', 'on',
  'or', 'os', 'ra', 'ris', 'ro', 'sar', 'tis', 'us', 'yn', 'x',
];

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function generateStarName(rng: SeededRng): string {
  const prefix = rng.pick(PREFIXES);
  const middle = rng.pick(MIDDLES);
  const suffix = rng.pick(SUFFIXES);
  return prefix + middle + suffix;
}

export function planetName(starName: string, orbitalIndex: number): string {
  const numeral = ROMAN_NUMERALS[orbitalIndex] ?? `${orbitalIndex + 1}`;
  return `${starName} ${numeral}`;
}

export function moonName(parentPlanetName: string, moonIndex: number): string {
  const letter = String.fromCharCode(97 + moonIndex); // a, b, c, ...
  return `${parentPlanetName} ${letter}`;
}

export function asteroidName(starName: string, designation: number): string {
  return `${starName} ${String(designation).padStart(4, '0')}`;
}
