export function getFeatOrAsiLevels(_classId?: string): number[] {
  return [4, 8, 12, 16, 19];
}

export function getAvailableAdvancementSlots(
  level: number,
  classId?: string
): number[] {
  const normalized = Math.max(1, Math.floor(level || 1));
  return getFeatOrAsiLevels(classId).filter((slot) => slot <= normalized);
}
