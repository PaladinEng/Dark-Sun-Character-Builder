import type { z } from "zod";

import {
  BackgroundSchema,
  ClassSchema,
  EquipmentSchema,
  FeatSchema,
  FeatureSchema,
  SpellListSchema,
  SpellSchema,
  SpeciesSchema,
  type Background,
  type Class,
  type Equipment,
  type Feat,
  type Feature,
  type Spell,
  type SpellList,
  type Species
} from "./entities";
import { mergePacks, type MergedContent } from "./merge";
import type { Pack } from "./load";

const ENTITY_TYPES = [
  "species",
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
  for (const background of content.backgrounds) {
    const fixedOrigin = background.grantsOriginFeatId ?? background.grantsFeat;
    if (fixedOrigin && !content.featsById[fixedOrigin]) {
      issues.push({
        code: "DANGLING_REFERENCE",
        message: `Background "${background.id}" references missing feat "${fixedOrigin}".`,
        entityType: "backgrounds",
        entityId: background.id,
        path: "grantsOriginFeatId"
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
  }

  for (const klass of content.classes) {
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

    for (const spellListId of klass.spellListRefs ?? []) {
      if (!content.spellListsById[spellListId]) {
        issues.push({
          code: "DANGLING_REFERENCE",
          message: `Class "${klass.id}" references missing spell list "${spellListId}" in spellListRefs.`,
          entityType: "classes",
          entityId: klass.id,
          path: "spellListRefs"
        });
      }
    }
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
