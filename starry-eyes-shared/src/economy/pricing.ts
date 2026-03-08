import { SPREAD_MARGIN, PRICE_FLOOR, PRICE_CEILING } from './commodities.js';

const AU = 1.496e11;

function clampPrice(price: number, basePrice: number): number {
  return Math.max(basePrice * PRICE_FLOOR, Math.min(basePrice * PRICE_CEILING, price));
}

/**
 * Ask price: what the station charges when the player buys (exports).
 * availableForSale = max(1, stockpile - reserve)
 */
export function computeAskPrice(
  basePrice: number,
  target: number,
  availableForSale: number,
  exponent = 1,
): number {
  const ratio = target / Math.max(availableForSale, 1);
  const raw = basePrice * Math.pow(ratio, exponent) * (1 + SPREAD_MARGIN);
  return clampPrice(raw, basePrice);
}

/**
 * Bid price: what the station pays when the player sells (imports).
 */
export function computeBidPrice(
  basePrice: number,
  target: number,
  stockpile: number,
  exponent = 1,
): number {
  const ratio = target / Math.max(stockpile, 1);
  const raw = basePrice * Math.pow(ratio, exponent) * (1 - SPREAD_MARGIN);
  return clampPrice(raw, basePrice);
}

/** @deprecated Use computeAskPrice or computeBidPrice instead */
export function computePrice(
  basePrice: number,
  stockpile: number,
  target: number,
  exponent = 1,
): number {
  const ratio = target / Math.max(stockpile, 0.01);
  const raw = basePrice * Math.pow(ratio, exponent);
  return clampPrice(raw, basePrice);
}

export function computeSunlightFactor(
  distanceFromStar: number,
  starLuminositySolar: number,
): number {
  const habitableDistance = Math.sqrt(starLuminositySolar) * AU;
  const ratio = habitableDistance / Math.max(distanceFromStar, 1);
  return Math.min(1, ratio * ratio);
}
