export const TOOL_PROFICIENCY_VALUES = [
  "Alchemist's Supplies",
  "Brewer's Supplies",
  "Calligrapher's Supplies",
  "Carpenter's Tools",
  "Cartographer's Tools",
  "Cobbler's Tools",
  "Cook's Utensils",
  "Disguise Kit",
  "Forgery Kit",
  "Gaming Set",
  "Glassblower's Tools",
  "Herbalism Kit",
  "Jeweler's Tools",
  "Leatherworker's Tools",
  "Mason's Tools",
  "Musical Instrument",
  "Navigator's Tools",
  "Painter's Supplies",
  "Poisoner's Kit",
  "Potter's Tools",
  "Smith's Tools",
  "Thieves' Tools",
  "Tinker's Tools",
  "Vehicles (Land)",
  "Vehicles (Water)",
  "Weaver's Tools",
  "Woodcarver's Tools"
] as const;

export const LANGUAGE_VALUES = [
  "Abyssal",
  "Celestial",
  "Common",
  "Deep Speech",
  "Draconic",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Infernal",
  "Orc",
  "Primordial",
  "Sylvan",
  "Thri-kreen",
  "Undercommon"
] as const;

const TOOL_PROFICIENCY_SET = new Set<string>(TOOL_PROFICIENCY_VALUES);
const LANGUAGE_SET = new Set<string>(LANGUAGE_VALUES);

export function isKnownToolProficiency(value: string): boolean {
  return TOOL_PROFICIENCY_SET.has(value);
}

export function isKnownLanguage(value: string): boolean {
  return LANGUAGE_SET.has(value);
}
