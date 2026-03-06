import type { AbilityRecord } from "./types";

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_MIN_SCORE = 8;
export const POINT_BUY_MAX_SCORE = 15;
export const POINT_BUY_BUDGET = 27;

const POINT_BUY_COST_BY_SCORE: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export function getPointBuyScoreCost(score: number): number | null {
  if (!Number.isInteger(score)) {
    return null;
  }
  return POINT_BUY_COST_BY_SCORE[score] ?? null;
}

export function computePointBuyCost(abilities: AbilityRecord): number | null {
  let total = 0;
  for (const score of Object.values(abilities)) {
    const scoreCost = getPointBuyScoreCost(score);
    if (scoreCost === null) {
      return null;
    }
    total += scoreCost;
  }
  return total;
}

export function isStandardArray(abilities: AbilityRecord): boolean {
  const scores = Object.values(abilities).sort((a, b) => b - a);
  return scores.every((score, index) => score === STANDARD_ARRAY[index]);
}
