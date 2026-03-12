import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { MergedContent } from "@dark-sun/content";

type BuilderOptions = {
  species: Array<{ id: string; name: string }>;
  backgrounds: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  subclasses: Array<{ id: string; name: string; classId?: string }>;
  armor: Array<{ id: string; name: string }>;
  shields: Array<{ id: string; name: string }>;
  weapons: Array<{ id: string; name: string }>;
  adventuringGear: Array<{ id: string; name: string }>;
};

export type SettingLanguageCategory = {
  id: string;
  name: string;
  languages: Array<{
    id: string;
    name: string;
    speakers?: string;
  }>;
};

export type SettingLanguageConfig = {
  selectionRules: {
    baseLanguages: string[];
    additionalChoices: number;
    literacyDefault: boolean;
  };
  categories: SettingLanguageCategory[];
  notes: string[];
};

export type SettingTradition = {
  id: string;
  name: string;
};

export type SettingWildTalentRow = {
  roll: number;
  id: string;
  name: string;
};

export type PackSettingProfile = {
  id: string;
  packId: string;
  name: string;
  speciesReplacementIds: string[];
  backgroundReplacementIds: string[];
  classSpellListOverrides: Record<string, string[]>;
  disabledClassIds: string[];
  classReplacements: Record<string, string>;
  disabledSubclassIds: string[];
  unresolvedDisabledSubclassKeys: string[];
  wildTalentRequired: boolean;
  wildTalentFeatureTag?: string;
  arcaneCastingModes: string[];
  notes: string[];
  unsupportedMechanics: string[];
  languages?: SettingLanguageConfig;
  traditions?: SettingTradition[];
  wildTalents?: {
    selection: {
      method?: string;
      dice?: string;
      requiredAtCharacterCreation?: boolean;
    };
    notes: string[];
    table: SettingWildTalentRow[];
  };
  preserverSystem?: Record<string, unknown>;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isRecordOfStringArrays(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((entry) => isStringArray(entry))
  );
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function resolvePackRoot(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "content", "packs"),
    path.resolve(cwd, "apps", "web", "content", "packs"),
  ];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      // Continue searching.
    }
  }

  return candidates[0];
}

function parseProfile(raw: unknown): Omit<PackSettingProfile, "languages" | "traditions" | "wildTalents" | "preserverSystem"> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    typeof value.packId !== "string" ||
    typeof value.name !== "string" ||
    !isStringArray(value.disabledClassIds) ||
    typeof value.classReplacements !== "object" ||
    value.classReplacements === null ||
    !isStringArray(value.disabledSubclassIds) ||
    !isStringArray(value.unresolvedDisabledSubclassKeys) ||
    typeof value.wildTalentRequired !== "boolean" ||
    !isStringArray(value.arcaneCastingModes) ||
    !isStringArray(value.notes) ||
    !isStringArray(value.unsupportedMechanics)
  ) {
    return null;
  }

  const classReplacements = Object.fromEntries(
    Object.entries(value.classReplacements as Record<string, unknown>).flatMap(
      ([key, replacement]) =>
        typeof replacement === "string" ? ([[key, replacement]] as Array<[string, string]>) : [],
    ),
  ) as Record<string, string>;
  const classSpellListOverrides = Object.fromEntries(
    Object.entries(
      isRecordOfStringArrays(value.classSpellListOverrides) ? value.classSpellListOverrides : {},
    ).map(([key, spellListIds]) => [key, [...spellListIds]]),
  ) as Record<string, string[]>;

  return {
    id: value.id,
    packId: value.packId,
    name: value.name,
    speciesReplacementIds: isStringArray(value.speciesReplacementIds)
      ? value.speciesReplacementIds
      : [],
    backgroundReplacementIds: isStringArray(value.backgroundReplacementIds)
      ? value.backgroundReplacementIds
      : [],
    classSpellListOverrides,
    disabledClassIds: value.disabledClassIds,
    classReplacements,
    disabledSubclassIds: value.disabledSubclassIds,
    unresolvedDisabledSubclassKeys: value.unresolvedDisabledSubclassKeys,
    wildTalentRequired: value.wildTalentRequired,
    wildTalentFeatureTag:
      typeof value.wildTalentFeatureTag === "string" ? value.wildTalentFeatureTag : undefined,
    arcaneCastingModes: value.arcaneCastingModes,
    notes: value.notes,
    unsupportedMechanics: value.unsupportedMechanics,
  };
}

function parseLanguages(raw: unknown): SettingLanguageConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const selectionRules = value.selectionRules as Record<string, unknown> | undefined;
  if (
    !selectionRules ||
    !isStringArray(selectionRules.baseLanguages) ||
    typeof selectionRules.additionalChoices !== "number" ||
    typeof selectionRules.literacyDefault !== "boolean"
  ) {
    return undefined;
  }

  const categories = Array.isArray(value.categories)
    ? value.categories
        .map((category) => {
          if (!category || typeof category !== "object") {
            return null;
          }
          const entry = category as Record<string, unknown>;
          if (typeof entry.id !== "string" || typeof entry.name !== "string") {
            return null;
          }
          const languages = Array.isArray(entry.languages)
            ? entry.languages
                .map((language) => {
                  if (!language || typeof language !== "object") {
                    return null;
                  }
                  const item = language as Record<string, unknown>;
                  if (typeof item.id !== "string" || typeof item.name !== "string") {
                    return null;
                  }
                  return {
                    id: item.id,
                    name: item.name,
                    speakers: typeof item.speakers === "string" ? item.speakers : undefined,
                  };
                })
                .filter((language): language is NonNullable<typeof language> => Boolean(language))
            : [];
          return {
            id: entry.id,
            name: entry.name,
            languages,
          };
        })
        .filter((category): category is NonNullable<typeof category> => Boolean(category))
    : [];

  return {
    selectionRules: {
      baseLanguages: selectionRules.baseLanguages,
      additionalChoices: selectionRules.additionalChoices,
      literacyDefault: selectionRules.literacyDefault,
    },
    categories,
    notes: isStringArray(value.notes) ? value.notes : [],
  };
}

function parseTraditions(raw: unknown): SettingTradition[] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.traditions)) {
    return undefined;
  }
  return value.traditions
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.name !== "string") {
        return null;
      }
      return {
        id: item.id,
        name: item.name,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

function parseWildTalents(raw: unknown): PackSettingProfile["wildTalents"] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const selection = (value.selection ?? {}) as Record<string, unknown>;
  if (!Array.isArray(value.table)) {
    return undefined;
  }
  return {
    selection: {
      method: typeof selection.method === "string" ? selection.method : undefined,
      dice: typeof selection.dice === "string" ? selection.dice : undefined,
      requiredAtCharacterCreation:
        typeof selection.requiredAtCharacterCreation === "boolean"
          ? selection.requiredAtCharacterCreation
          : undefined,
    },
    notes: isStringArray(value.notes) ? value.notes : [],
    table: value.table
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const item = entry as Record<string, unknown>;
        if (
          typeof item.roll !== "number" ||
          typeof item.id !== "string" ||
          typeof item.name !== "string"
        ) {
          return null;
        }
        return {
          roll: item.roll,
          id: item.id,
          name: item.name,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  };
}

export async function getResolvedPackSettings(
  enabledPackIds: string[],
): Promise<PackSettingProfile | null> {
  if (enabledPackIds.length === 0) {
    return null;
  }

  const packRoot = await resolvePackRoot();
  let merged: PackSettingProfile | null = null;

  for (const packId of enabledPackIds) {
    const settingsDir = path.join(packRoot, packId, "settings");
    try {
      await readdir(settingsDir);
    } catch {
      continue;
    }

    const profile = parseProfile(await readJson(path.join(settingsDir, "profile.json")));
    if (!profile) {
      continue;
    }

    const next: PackSettingProfile = {
      ...profile,
      languages: parseLanguages(await readJson(path.join(settingsDir, "languages.json"))),
      traditions: parseTraditions(await readJson(path.join(settingsDir, "traditions.json"))),
      wildTalents: parseWildTalents(await readJson(path.join(settingsDir, "wild-talents.json"))),
      preserverSystem: (await readJson(path.join(settingsDir, "preserver-system.json"))) as Record<
        string,
        unknown
      >,
    };

    if (!merged) {
      merged = next;
      continue;
    }

    merged = {
      ...merged,
      speciesReplacementIds: Array.from(
        new Set([...merged.speciesReplacementIds, ...next.speciesReplacementIds]),
      ),
      backgroundReplacementIds: Array.from(
        new Set([...merged.backgroundReplacementIds, ...next.backgroundReplacementIds]),
      ),
      classSpellListOverrides: {
        ...merged.classSpellListOverrides,
        ...next.classSpellListOverrides,
      },
      disabledClassIds: Array.from(new Set([...merged.disabledClassIds, ...next.disabledClassIds])),
      classReplacements: {
        ...merged.classReplacements,
        ...next.classReplacements,
      },
      disabledSubclassIds: Array.from(
        new Set([...merged.disabledSubclassIds, ...next.disabledSubclassIds]),
      ),
      unresolvedDisabledSubclassKeys: Array.from(
        new Set([
          ...merged.unresolvedDisabledSubclassKeys,
          ...next.unresolvedDisabledSubclassKeys,
        ]),
      ),
      arcaneCastingModes: Array.from(
        new Set([...merged.arcaneCastingModes, ...next.arcaneCastingModes]),
      ),
      notes: Array.from(new Set([...merged.notes, ...next.notes])),
      unsupportedMechanics: Array.from(
        new Set([...merged.unsupportedMechanics, ...next.unsupportedMechanics]),
      ),
      languages: next.languages ?? merged.languages,
      traditions: next.traditions ?? merged.traditions,
      wildTalents: next.wildTalents ?? merged.wildTalents,
      preserverSystem: next.preserverSystem ?? merged.preserverSystem,
    };
  }

  return merged;
}

export function applySettingRestrictions(
  options: BuilderOptions,
  settings: PackSettingProfile | null,
): BuilderOptions {
  if (!settings) {
    return options;
  }

  const disabledClassIds = new Set(settings.disabledClassIds);
  for (const replacedClassId of Object.keys(settings.classReplacements)) {
    disabledClassIds.add(replacedClassId);
  }
  const disabledSubclassIds = new Set(settings.disabledSubclassIds);
  const speciesReplacementIds =
    settings.speciesReplacementIds.length > 0 ? new Set(settings.speciesReplacementIds) : null;
  const backgroundReplacementIds =
    settings.backgroundReplacementIds.length > 0
      ? new Set(settings.backgroundReplacementIds)
      : null;

  return {
    ...options,
    species: speciesReplacementIds
      ? options.species.filter((entry) => speciesReplacementIds.has(entry.id))
      : options.species,
    backgrounds: backgroundReplacementIds
      ? options.backgrounds.filter((entry) => backgroundReplacementIds.has(entry.id))
      : options.backgrounds,
    classes: options.classes.filter((entry) => !disabledClassIds.has(entry.id)),
    subclasses: options.subclasses.filter((entry) => !disabledSubclassIds.has(entry.id)),
  };
}

export function applySettingContentOverrides(
  content: MergedContent,
  settings: PackSettingProfile | null,
): MergedContent {
  if (!settings || Object.keys(settings.classSpellListOverrides).length === 0) {
    return content;
  }

  let changed = false;
  const classes = content.classes.map((entry) => {
    const overrideIds = settings.classSpellListOverrides[entry.id];
    if (!overrideIds) {
      return entry;
    }
    const normalizedOverrideIds = [...overrideIds];
    const currentIds = entry.spellListRefIds ?? entry.spellListRefs ?? [];
    if (JSON.stringify(currentIds) === JSON.stringify(normalizedOverrideIds)) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      spellListRefIds: normalizedOverrideIds,
      spellListRefs: normalizedOverrideIds,
    };
  });

  if (!changed) {
    return content;
  }

  const classesById = Object.fromEntries(classes.map((entry) => [entry.id, entry]));

  return {
    ...content,
    classes,
    classesById,
  };
}
