import type { Spell } from "@dark-sun/content";

type SpellFlagSource = Pick<Spell, "ritual" | "concentration">;
type SpellLabelSource = Pick<Spell, "name" | "ritual" | "concentration">;

export function formatSpellFlags(spell: SpellFlagSource): string {
  const flags: string[] = [];
  if (spell.ritual) {
    flags.push("R");
  }
  if (spell.concentration) {
    flags.push("C");
  }
  return flags.length > 0 ? ` (${flags.join(", ")})` : "";
}

export function formatSpellNameWithFlags(spell: SpellLabelSource): string {
  return `${spell.name}${formatSpellFlags(spell)}`;
}
