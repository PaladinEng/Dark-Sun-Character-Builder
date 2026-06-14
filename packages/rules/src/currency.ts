/**
 * Currency denominations. Standard D&D uses CP/SP/EP/GP/PP; the Dark Sun
 * (Athasian) setting uses a base-10 Bit/Ceramic/Silver/Gold system with no
 * Electrum or Platinum.
 */
export type CoinKey = "bit" | "cp" | "sp" | "ep" | "gp" | "pp";

export const COIN_LABELS: Record<CoinKey, string> = {
  bit: "Bits",
  cp: "CP",
  sp: "SP",
  ep: "EP",
  gp: "GP",
  pp: "PP",
};

/** Standard D&D denominations, ordered low to high. */
export const SRD_COIN_DENOMINATIONS: CoinKey[] = ["cp", "sp", "ep", "gp", "pp"];

/** Athasian denominations, ordered low to high (base-10: 10 bit = 1 cp = ... ). */
export const DARKSUN_COIN_DENOMINATIONS: CoinKey[] = ["bit", "cp", "sp", "gp"];

/** Returns the ordered (low → high) coin denominations for the active setting. */
export function getCoinDenominations(isDarkSun: boolean): CoinKey[] {
  return isDarkSun ? DARKSUN_COIN_DENOMINATIONS : SRD_COIN_DENOMINATIONS;
}
