export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
export type SpellcastingAbility = Ability;

export type AbilityRecord = Record<Ability, number>;

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

export interface CharacterState {
  level: number;
  baseAbilities: AbilityRecord;
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
  equippedArmorId?: string;
  equippedShieldId?: string;
  equippedWeaponId?: string;
  baseSpeed?: number;
}

export interface DerivedState {
  finalAbilities: AbilityRecord;
  abilityMods: AbilityRecord;
  proficiencyBonus: number;
  speed: number;
  savingThrows: AbilityRecord;
  skills: Record<string, number>;
  skillProficiencies: string[];
  saveProficiencies: Ability[];
  toolProficiencies: string[];
  languages: string[];
  passivePerception: number;
  maxHP: number;
  armorClass: number;
  attack: { name: string; toHit: number; damage: string } | null;
  spellcastingAbility: SpellcastingAbility | null;
  spellSaveDC: number | null;
  spellAttackBonus: number | null;
  spellSlots: Record<number, number> | null;
  spellcasting?: {
    ability: SpellcastingAbility;
    abilityMod: number;
    saveDC: number;
    attackBonus: number;
    progression: "full" | "half" | "third" | "pact";
    slots: Record<number, number>;
    knownSpellIds: string[];
    preparedSpellIds: string[];
    cantripsKnownIds: string[];
  };
  feats: { id: string; name: string }[];
  warnings: string[];
  advancementSlots: Array<{
    level: number;
    filled: boolean;
    choice?: "feat" | "asi";
    feat?: { id: string; name: string };
    asi?: Partial<Record<Ability, number>>;
  }>;
}
