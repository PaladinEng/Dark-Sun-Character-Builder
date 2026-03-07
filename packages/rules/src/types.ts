export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
export type SpellcastingAbility = Ability;
export type SpellSlots = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type AbilityRecord = Record<Ability, number>;
export const ABILITY_SCORE_METHODS = ["manual", "standard_array", "point_buy"] as const;
export type AbilityScoreMethod = (typeof ABILITY_SCORE_METHODS)[number];
export const CONDITION_IDS = ["encumbered"] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];
export type CharacterConditions = Partial<Record<ConditionId, boolean>>;

export interface AbilityIncrease {
  source: "background" | "feat" | "other";
  changes: Partial<Record<Ability, number>>;
}

export type Advancement =
  | { type: "feat"; featId: string; source: "level"; level: number }
  | {
      type: "asi";
      changes: Partial<Record<Ability, number>>;
      source: "level";
      level: number;
    };

export interface FeatSelections {
  origin?: string;
  level?: Record<number, string>;
}

export interface CharacterCoins {
  gp: number;
  sp: number;
  ep?: number;
  pp?: number;
  cp: number;
}

export interface InventoryEntry {
  itemId: string;
  quantity?: number;
}

export interface CompanionPlaceholder {
  name?: string;
  type?: string;
  summary?: string;
  notes?: string;
}

export interface CharacterState {
  level: number;
  baseAbilities: AbilityRecord;
  abilityScoreMethod?: AbilityScoreMethod;
  abilities?: AbilityRecord;
  abilityIncreases?: AbilityIncrease[];
  selectedSpeciesId?: string;
  selectedBackgroundId?: string;
  selectedClassId?: string;
  selectedFeatureIds?: string[];
  featSelections?: FeatSelections;
  // Legacy fields retained for backwards compatibility with older saves/fixtures.
  selectedFeats?: string[];
  originFeatId?: string;
  chosenClassSkills?: string[];
  touched?: {
    classSkills?: boolean;
  };
  advancements?: Advancement[];
  chosenSkillProficiencies: string[];
  chosenSaveProficiencies: Ability[];
  toolProficiencies?: string[];
  languages?: string[];
  knownSpellIds?: string[];
  preparedSpellIds?: string[];
  cantripsKnownIds?: string[];
  coins?: Partial<CharacterCoins>;
  otherWealth?: string;
  inventoryItemIds?: string[];
  inventoryEntries?: InventoryEntry[];
  equippedArmorId?: string;
  equippedShieldId?: string;
  equippedWeaponId?: string;
  armorProficiencies?: string[];
  weaponProficiencies?: string[];
  subclass?: string;
  xp?: number;
  heroicInspiration?: boolean;
  tempHP?: number;
  hitDiceTotal?: number;
  hitDiceSpent?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  exhaustionLevel?: number;
  attunedItems?: string[];
  appearance?: string;
  physicalDescription?: string;
  backstory?: string;
  alignment?: string;
  notes?: string;
  companion?: CompanionPlaceholder;
  familiar?: CompanionPlaceholder;
  baseSpeed?: number;
  conditions?: CharacterConditions;
}

export interface DerivedStartingEquipment {
  itemIds: string[];
  equippedArmorId?: string;
  equippedShieldId?: string;
  equippedWeaponId?: string;
}

export interface DerivedSense {
  type: string;
  range?: number;
}

export interface DerivedState {
  finalAbilities: AbilityRecord;
  abilityMods: AbilityRecord;
  proficiencyBonus: number;
  speed: number;
  senses: DerivedSense[];
  resistances: string[];
  traits: string[];
  savingThrows: AbilityRecord;
  skills: Record<string, number>;
  skillProficiencies: string[];
  saveProficiencies: Ability[];
  toolProficiencies: string[];
  languages: string[];
  passivePerception: number;
  maxHP: number;
  armorClass: number;
  attack: { name: string; toHit: number; damage: string; mastery?: string[] } | null;
  spellcastingAbility: SpellcastingAbility | null;
  spellSaveDC: number | null;
  spellAttackBonus: number | null;
  spellSlots: SpellSlots | null;
  spellcasting?: {
    ability: SpellcastingAbility;
    abilityMod: number;
    saveDC: number;
    attackBonus: number;
    progression: "full" | "half" | "third" | "pact";
    slots: SpellSlots;
    knownSpellIds: string[];
    preparedSpellIds: string[];
    cantripsKnownIds: string[];
  };
  feats: { id: string; name: string }[];
  warnings: string[];
  startingEquipment?: DerivedStartingEquipment;
  activeConditionIds?: ConditionId[];
  appliedModifiers?: DerivedModifier[];
  advancementSlots: Array<{
    level: number;
    filled: boolean;
    choice?: "feat" | "asi";
    feat?: { id: string; name: string };
    asi?: Partial<Record<Ability, number>>;
  }>;
}

export type DerivedModifierEffect = {
  type: "add_speed";
  value: number;
};

export interface DerivedModifier {
  id: string;
  source: "condition";
  sourceId: ConditionId;
  label: string;
  effects: DerivedModifierEffect[];
}
