export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

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

export interface CharacterState {
  level: number;
  baseAbilities: AbilityRecord;
  abilities?: AbilityRecord;
  abilityIncreases?: AbilityIncrease[];
  selectedSpeciesId?: string;
  selectedBackgroundId?: string;
  selectedClassId?: string;
  selectedFeatureIds?: string[];
  selectedFeats?: string[];
  advancements?: Advancement[];
  chosenSkillProficiencies: string[];
  chosenSaveProficiencies: Ability[];
  toolProficiencies?: string[];
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
  toolProficiencies: string[];
  maxHP: number;
  armorClass: number;
  attack: { name: string; toHit: number; damage: string } | null;
  feats: { id: string; name: string }[];
  advancementSlots: Array<{
    level: number;
    filled: boolean;
    choice?: "feat" | "asi";
    feat?: { id: string; name: string };
    asi?: Partial<Record<Ability, number>>;
  }>;
}
