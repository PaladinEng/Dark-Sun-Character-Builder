import type { z } from "zod";

import {
  BackgroundSchema,
  ClassSchema,
  EquipmentSchema,
  FeatSchema,
  FeatureSchema,
  SkillDefinitionSchema,
  SpellListSchema,
  SpellSchema,
  SpeciesSchema,
  getClassSpellListRefIds,
  type Background,
  type Class,
  type Equipment,
  type Feat,
  type Feature,
  type SkillDefinition,
  type Spell,
  type SpellList,
  type Species
} from "./entities";
import { mergePacks, type MergedContent } from "./merge";
import type { Pack } from "./load";
import { isKnownLanguage, isKnownToolProficiency } from "./proficiencies";

type StartingEquipmentBundle = {
  itemIds?: string[];
  equippedArmorId?: string;
  equippedShieldId?: string;
  equippedWeaponId?: string;
};

const ENTITY_TYPES = [
  "species",
  "skillDefinitions",
  "backgrounds",
  "classes",
  "features",
  "feats",
  "equipment",
  "spells",
  "spellLists"
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

type PackEntity =
  | Species
  | SkillDefinition
  | Background
  | Class
  | Feature
  | Feat
  | Equipment
  | Spell
  | SpellList;

type EntitySchema = z.ZodType<PackEntity>;

function schemaFor(entityType: EntityType): EntitySchema {
  switch (entityType) {
    case "species":
      return SpeciesSchema;
    case "skillDefinitions":
      return SkillDefinitionSchema;
    case "backgrounds":
      return BackgroundSchema;
    case "classes":
      return ClassSchema;
    case "features":
      return FeatureSchema;
    case "feats":
      return FeatSchema;
    case "equipment":
      return EquipmentSchema;
    case "spells":
      return SpellSchema;
    case "spellLists":
      return SpellListSchema;
  }
}

function entityLabel(entityType: EntityType): string {
  return entityType;
}

export interface ContentLintIssue {
  code:
    | "DUPLICATE_ENTITY_ID"
    | "CONFLICTING_REPLACEMENT"
    | "DANGLING_REPLACEMENT_TARGET"
    | "DANGLING_REFERENCE"
    | "SCHEMA_VALIDATION_FAILED";
  message: string;
  packId?: string;
  entityType?: EntityType;
  entityId?: string;
  path?: string;
}

export interface ContentLintReport {
  errors: ContentLintIssue[];
  warnings: ContentLintIssue[];
}

function lintPerPackEntityShape(packs: Pack[], issues: ContentLintIssue[]): void {
  for (const pack of packs) {
    const seenEntityTypeById = new Map<string, EntityType>();

    for (const entityType of ENTITY_TYPES) {
      const entities = pack.entities[entityType] as PackEntity[];
      const schema = schemaFor(entityType);
      const seenIds = new Set<string>();
      const seenReplaceTargets = new Set<string>();

      for (const entity of entities) {
        const parsed = schema.safeParse(entity);
        if (!parsed.success) {
          issues.push({
            code: "SCHEMA_VALIDATION_FAILED",
            message: `Schema validation failed for ${entityLabel(entityType)} "${entity.id}" in pack "${pack.manifest.id}".`,
            packId: pack.manifest.id,
            entityType,
            entityId: entity.id,
            path: parsed.error.issues[0]?.path.join(".")
          });
        }

        if (seenIds.has(entity.id)) {
          issues.push({
            code: "DUPLICATE_ENTITY_ID",
            message: `Duplicate ${entityLabel(entityType)} id "${entity.id}" in pack "${pack.manifest.id}".`,
            packId: pack.manifest.id,
            entityType,
            entityId: entity.id
          });
        }
        seenIds.add(entity.id);

        const existingEntityType = seenEntityTypeById.get(entity.id);
        if (existingEntityType && existingEntityType !== entityType) {
          issues.push({
            code: "DUPLICATE_ENTITY_ID",
            message:
              `Duplicate entity id "${entity.id}" in pack "${pack.manifest.id}" ` +
              `across ${entityLabel(existingEntityType)} and ${entityLabel(entityType)}.`,
            packId: pack.manifest.id,
            entityType,
            entityId: entity.id
          });
        } else if (!existingEntityType) {
          seenEntityTypeById.set(entity.id, entityType);
        }

        const replaceTarget = (entity as { replaces?: string }).replaces;
        if (!replaceTarget) {
          continue;
        }
        if (seenReplaceTargets.has(replaceTarget)) {
          issues.push({
            code: "CONFLICTING_REPLACEMENT",
            message: `Multiple ${entityLabel(entityType)} entries in pack "${pack.manifest.id}" replace "${replaceTarget}".`,
            packId: pack.manifest.id,
            entityType,
            entityId: entity.id
          });
        }
        seenReplaceTargets.add(replaceTarget);
      }
    }
  }
}

function lintDanglingReplacements(packs: Pack[], issues: ContentLintIssue[]): void {
  const knownByType: Record<EntityType, Set<string>> = {
    species: new Set<string>(),
    skillDefinitions: new Set<string>(),
    backgrounds: new Set<string>(),
    classes: new Set<string>(),
    features: new Set<string>(),
    feats: new Set<string>(),
    equipment: new Set<string>(),
    spells: new Set<string>(),
    spellLists: new Set<string>()
  };

  for (const pack of packs) {
    for (const entityType of ENTITY_TYPES) {
      const known = knownByType[entityType];
      const entities = pack.entities[entityType] as PackEntity[];
      for (const entity of entities) {
        const replaceTarget = (entity as { replaces?: string }).replaces;
        if (replaceTarget && !known.has(replaceTarget)) {
          issues.push({
            code: "DANGLING_REPLACEMENT_TARGET",
            message: `${entityLabel(entityType)} "${entity.id}" in pack "${pack.manifest.id}" replaces missing target "${replaceTarget}".`,
            packId: pack.manifest.id,
            entityType,
            entityId: entity.id
          });
        }
        if (replaceTarget) {
          known.delete(replaceTarget);
        }
        known.add(entity.id);
      }
    }
  }
}

function lintMergedReferences(content: MergedContent, issues: ContentLintIssue[]): void {
  const knownSkillIds = new Set(content.skillDefinitions.map((skill) => skill.id));
  const hasSkillDefinitions = knownSkillIds.size > 0;

  const lintEffectReference = (
    ownerType: Exclude<EntityType, "equipment" | "spells" | "spellLists" | "skillDefinitions">,
    ownerId: string,
    effects: Array<{
      type: string;
      target?: string;
      key?: string;
      skill?: string;
      tool?: string;
      language?: string;
    }> | undefined
  ) => {
    if (!effects) {
      return;
    }

    const ownerLabelMap: Record<
      Exclude<EntityType, "equipment" | "spells" | "spellLists" | "skillDefinitions">,
      string
    > = {
      species: "Species",
      backgrounds: "Background",
      classes: "Class",
      features: "Feature",
      feats: "Feat"
    };
    const ownerLabel = ownerLabelMap[ownerType];

    for (const [index, effect] of effects.entries()) {
      if (
        hasSkillDefinitions &&
        effect.type === "grant_skill_proficiency" &&
        typeof effect.skill === "string" &&
        !knownSkillIds.has(effect.skill)
      ) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" references unknown skill "${effect.skill}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: `effects[${index}].skill`,
        });
      }

      if (
        hasSkillDefinitions &&
        effect.type === "add_bonus" &&
        effect.target === "skill" &&
        typeof effect.key === "string" &&
        !knownSkillIds.has(effect.key)
      ) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" references unknown skill bonus target "${effect.key}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: `effects[${index}].key`,
        });
      }

      if (effect.type === "grant_tool_proficiency") {
        const tool = effect.tool;
        if (typeof tool === "string" && !isKnownToolProficiency(tool)) {
          issues.push({
            code: "DANGLING_REFERENCE",
            message: `${ownerLabel} "${ownerId}" references unknown tool proficiency "${tool}".`,
            entityType: ownerType,
            entityId: ownerId,
            path: `effects[${index}].tool`,
          });
        }
      }

      if (effect.type === "grant_language") {
        const language = effect.language;
        if (typeof language === "string" && !isKnownLanguage(language)) {
          issues.push({
            code: "DANGLING_REFERENCE",
            message: `${ownerLabel} "${ownerId}" references unknown language "${language}".`,
            entityType: ownerType,
            entityId: ownerId,
            path: `effects[${index}].language`,
          });
        }
      }
    }
  };

  for (const species of content.species) {
    lintEffectReference("species", species.id, species.effects);
  }

  const lintStartingEquipmentReferences = (
    bundle: StartingEquipmentBundle | undefined,
    ownerType: "backgrounds" | "classes",
    ownerId: string,
  ) => {
    const ownerLabel = ownerType === "classes" ? "Class" : "Background";
    if (!bundle) {
      return;
    }

    for (const itemId of bundle.itemIds ?? []) {
      if (!content.equipmentById[itemId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment references missing item "${itemId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.itemIds",
        });
      }
    }

    if (bundle.equippedArmorId) {
      const item = content.equipmentById[bundle.equippedArmorId];
      if (!item) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment references missing equipped armor "${bundle.equippedArmorId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.equippedArmorId",
        });
      } else if (
        item.type !== "armor_light" &&
        item.type !== "armor_medium" &&
        item.type !== "armor_heavy"
      ) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment equippedArmorId is not armor "${bundle.equippedArmorId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.equippedArmorId",
        });
      }
    }

    if (bundle.equippedShieldId) {
      const item = content.equipmentById[bundle.equippedShieldId];
      if (!item) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment references missing equipped shield "${bundle.equippedShieldId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.equippedShieldId",
        });
      } else if (item.type !== "shield") {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment equippedShieldId is not a shield "${bundle.equippedShieldId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.equippedShieldId",
        });
      }
    }

    if (bundle.equippedWeaponId) {
      const item = content.equipmentById[bundle.equippedWeaponId];
      if (!item) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment references missing equipped weapon "${bundle.equippedWeaponId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.equippedWeaponId",
        });
      } else if (item.type !== "weapon") {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `${ownerLabel} "${ownerId}" starting equipment equippedWeaponId is not a weapon "${bundle.equippedWeaponId}".`,
          entityType: ownerType,
          entityId: ownerId,
          path: "startingEquipment.equippedWeaponId",
        });
      }
    }
  };

  for (const background of content.backgrounds) {
    const fixedOrigin = background.grantsOriginFeatId ?? background.grantsFeat;
    const fixedOriginPath = background.grantsOriginFeatId ? "grantsOriginFeatId" : "grantsFeat";
    if (fixedOrigin && !content.featsById[fixedOrigin]) {
      issues.push({
        code: "DANGLING_REFERENCE",
        message: `Background "${background.id}" references missing feat "${fixedOrigin}".`,
        entityType: "backgrounds",
        entityId: background.id,
        path: fixedOriginPath
      });
    }
    for (const featId of background.originFeatChoice?.featIds ?? []) {
      if (!content.featsById[featId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Background "${background.id}" originFeatChoice references missing feat "${featId}".`,
          entityType: "backgrounds",
          entityId: background.id,
          path: "originFeatChoice.featIds"
        });
      }
    }

    lintStartingEquipmentReferences(
      background.startingEquipment,
      "backgrounds",
      background.id,
    );

    lintEffectReference("backgrounds", background.id, background.effects);
  }

  for (const klass of content.classes) {
    if (hasSkillDefinitions) {
      for (const skillId of klass.classSkillChoices?.from ?? []) {
        if (!knownSkillIds.has(skillId)) {
          issues.push({
            code: "DANGLING_REFERENCE",
            message: `Class "${klass.id}" classSkillChoices references unknown skill "${skillId}".`,
            entityType: "classes",
            entityId: klass.id,
            path: "classSkillChoices.from"
          });
        }
      }
    }

    for (const weaponId of klass.weaponProficiencies?.weaponIds ?? []) {
      const weapon = content.equipmentById[weaponId];
      if (!weapon) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Class "${klass.id}" references missing weapon "${weaponId}" in weaponProficiencies.weaponIds.`,
          entityType: "classes",
          entityId: klass.id,
          path: "weaponProficiencies.weaponIds"
        });
      } else if (weapon.type !== "weapon") {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Class "${klass.id}" references non-weapon equipment "${weaponId}" in weaponProficiencies.weaponIds.`,
          entityType: "classes",
          entityId: klass.id,
          path: "weaponProficiencies.weaponIds"
        });
      }
    }

    const spellListRefIds = getClassSpellListRefIds(klass);
    for (const spellListId of spellListRefIds) {
      if (!content.spellListsById[spellListId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Class "${klass.id}" references missing spell list "${spellListId}" in spellListRefIds.`,
          entityType: "classes",
          entityId: klass.id,
          path: "spellListRefIds"
        });
      }
    }

    for (const entry of klass.classFeaturesByLevel ?? []) {
      if (!content.featuresById[entry.featureId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Class "${klass.id}" classFeaturesByLevel references missing feature "${entry.featureId}".`,
          entityType: "classes",
          entityId: klass.id,
          path: "classFeaturesByLevel"
        });
      }
    }

    lintStartingEquipmentReferences(klass.startingEquipment, "classes", klass.id);
    lintEffectReference("classes", klass.id, klass.effects);
  }

  for (const feature of content.features) {
    lintEffectReference("features", feature.id, feature.effects);
  }

  for (const feat of content.feats) {
    for (const classId of feat.prerequisites?.classIds ?? []) {
      if (!content.classesById[classId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Feat "${feat.id}" prerequisite references missing class "${classId}".`,
          entityType: "feats",
          entityId: feat.id,
          path: "prerequisites.classIds"
        });
      }
    }
    for (const speciesId of feat.prerequisites?.speciesIds ?? []) {
      if (!content.speciesById[speciesId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Feat "${feat.id}" prerequisite references missing species "${speciesId}".`,
          entityType: "feats",
          entityId: feat.id,
          path: "prerequisites.speciesIds"
        });
      }
    }
    for (const featureId of feat.prerequisites?.featureIds ?? []) {
      if (!content.featuresById[featureId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Feat "${feat.id}" prerequisite references missing feature "${featureId}".`,
          entityType: "feats",
          entityId: feat.id,
          path: "prerequisites.featureIds"
        });
      }
    }

    lintEffectReference("feats", feat.id, feat.effects);
  }

  for (const spellList of content.spellLists) {
    for (const spellId of spellList.spellIds) {
      if (!content.spellsById[spellId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Spell list "${spellList.id}" references missing spell "${spellId}".`,
          entityType: "spellLists",
          entityId: spellList.id,
          path: "spellIds"
        });
      }
    }
  }
}

export function lintPacks(packs: Pack[]): ContentLintReport {
  const errors: ContentLintIssue[] = [];
  const warnings: ContentLintIssue[] = [];

  lintPerPackEntityShape(packs, errors);
  lintDanglingReplacements(packs, errors);

  try {
    const merged = mergePacks(packs);
    lintMergedReferences(merged.content, errors);
  } catch (error) {
    errors.push({
      code: "SCHEMA_VALIDATION_FAILED",
      message:
        error instanceof Error ? `Merge failed: ${error.message}` : "Merge failed due to unknown error."
    });
  }

  return {
    errors,
    warnings
  };
}
