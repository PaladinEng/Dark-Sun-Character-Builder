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
  /** Athasian "bit" denomination (10 bits = 1 ceramic piece). Dark Sun only. */
  bit?: number;
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

export interface AttunedItem {
  name?: string;
  itemId?: string;
  notes?: string;
}

export interface CustomSpell {
  name: string;
  level: number;
  field: "known" | "prepared" | "cantrip";
  ritual?: boolean;
  concentration?: boolean;
  notes?: string;
}

export interface CustomGearItem {
  name: string;
  quantity?: number;
  notes?: string;
}

export interface CharacterState {
  characterName?: string;
  level: number;
  baseAbilities: AbilityRecord;
  abilityScoreMethod?: AbilityScoreMethod;
  abilities?: AbilityRecord;
  abilityIncreases?: AbilityIncrease[];
  selectedSpeciesId?: string;
  selectedBackgroundId?: string;
  selectedClassId?: string;
  selectedFeatureIds?: string[];
  /** Selected Wild Talent feature ID (Dark Sun setting). */
  wildTalentFeatureId?: string;
  /** Chosen Fighting Style feat ID, granted when a class feature triggers it. */
  chosenFightingStyleFeatId?: string;
  warlockInvocationFeatureIds?: string[];
  warlockPactBoonFeatureId?: string;
  warlockMysticArcanumByLevel?: Partial<Record<6 | 7 | 8 | 9, string>>;
  featSelections?: FeatSelections;
  /** Maps feat ID → chosen ability for half-feats that grant +1 to a chosen ability. */
  featAbilityChoices?: Record<string, Ability>;
  // Legacy fields retained for backwards compatibility with older saves/fixtures.
  selectedFeats?: string[];
  originFeatId?: string;
  chosenClassSkills?: string[];
  chosenSpeciesSkills?: string[];
  /** Maps a feature/feat/class id → chosen skill ids for its expertise choice. */
  chosenExpertiseSkills?: Record<string, string[]>;
  touched?: {
    classSkills?: boolean;
    speciesSkills?: boolean;
  };
  advancements?: Advancement[];
  chosenSkillProficiencies: string[];
  chosenSaveProficiencies: Ability[];
  toolProficiencies?: string[];
  languages?: string[];
  /** Maps language name → whether the character is literate in it. */
  languageLiteracy?: Record<string, boolean>;
  knownSpellIds?: string[];
  preparedSpellIds?: string[];
  cantripsKnownIds?: string[];
  customSpells?: CustomSpell[];
  customGear?: CustomGearItem[];
  coins?: Partial<CharacterCoins>;
  otherWealth?: string;
  inventoryItemIds?: string[];
  inventoryEntries?: InventoryEntry[];
  equippedArmorId?: string;
  equippedShieldId?: string;
  /**
   * Legacy single-weapon slot. Kept for backwards compatibility with older
   * fixtures and saves. New code should prefer {@link equippedWeaponIds}.
   */
  equippedWeaponId?: string;
  equippedWeaponIds?: string[];
  armorProficiencies?: string[];
  weaponProficiencies?: string[];
  subclass?: string;
  xp?: number;
  heroicInspiration?: boolean;
  currentHP?: number;
  tempHP?: number;
  hitDiceTotal?: number;
  hitDiceSpent?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  exhaustionLevel?: number;
  attunedItems?: AttunedItem[];
  appearance?: string;
  physicalDescription?: string;
  backstory?: string;
  alignment?: string;
  notes?: string;
  companion?: CompanionPlaceholder;
  familiar?: CompanionPlaceholder;
  baseSpeed?: number;
  conditions?: CharacterConditions;
  /** Free-text notes keyed by feature or feat ID. */
  featureNotes?: Record<string, string>;
  /** Weapon IDs the player has chosen for Weapon Mastery. */
  weaponMasteryChoices?: string[];
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
  /** Non-walking movement speeds in feet, keyed by movement type (climb/swim/fly/burrow). */
  movementSpeeds: Record<string, number>;
  senses: DerivedSense[];
  resistances: string[];
  traits: string[];
  savingThrows: AbilityRecord;
  skills: Record<string, number>;
  skillProficiencies: string[];
  /** Skill ids with expertise (proficiency bonus doubled). Subset of skillProficiencies. */
  skillExpertise: string[];
  saveProficiencies: Ability[];
  toolProficiencies: string[];
  weaponProficiencies: string[];
  armorProficiencies: string[];
  languages: string[];
  languageLiteracy: Record<string, boolean>;
  passivePerception: number;
  maxHP: number;
  armorClass: number;
  attacks: Array<{ name: string; toHit: number; damage: string; mastery?: string[] }>;
  /**
   * Legacy single-attack accessor. Equal to `attacks[0] ?? null`. Kept so
   * older callers continue to compile while the multi-weapon migration lands.
   */
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
    customSpells: CustomSpell[];
  };
  classResources: Array<{
    name: string;
    shortName?: string;
    total: number;
    recharge: "short_rest" | "long_rest";
  }>;
  /** Maximum number of weapons the character can apply mastery to (0 = no mastery). */
  weaponMasteryLimit: number;
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
