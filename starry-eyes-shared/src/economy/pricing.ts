const AU = 1.496e11;

export function computePrice(
  basePrice: number,
  stockpile: number,
  target: number,
  exponent = 1,
): number {
  const ratio = target / Math.max(stockpile, 0.01);
  const raw = basePrice * Math.pow(ratio, exponent);
  return Math.max(0.1 * basePrice, Math.min(10 * basePrice, raw));
}

export function computeSunlightFactor(
  distanceFromStar: number,
  starLuminositySolar: number,
): number {
  // Full output in habitable zone (~1 AU for Sol-like star)
  // Inverse-square scaling from there
  const habitableDistance = Math.sqrt(starLuminositySolar) * AU;
  const ratio = habitableDistance / Math.max(distanceFromStar, 1);
  return Math.min(1, ratio * ratio);
}
