"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { MergedContent, Spell } from "@dark-sun/content";
import type {
  AttunedItem,
  AbilityScoreMethod,
  CharacterState,
  DerivedState,
  ValidationReport,
} from "@dark-sun/rules";
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MAX_SCORE,
  POINT_BUY_MIN_SCORE,
  STANDARD_ARRAY,
  computePointBuyCost,
  computeDerivedState,
  getAvailableAdvancementSlots,
  getPointBuyScoreCost,
  getSkillAndToolDisplayRows,
  validateCharacter,
} from "@dark-sun/rules";
import { formatSpellNameWithFlags } from "../../src/lib/spells";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
type CoinDenomination = "gp" | "sp" | "ep" | "cp" | "pp";
type AbilityChanges = Partial<Record<Ability, number>>;

type BackgroundAbilityOptions = {
  abilities: Ability[];
  mode: "2+1_or_1+1+1";
};

type Option = {
  id: string;
  name: string;
  type?:
    | "armor_light"
    | "armor_medium"
    | "armor_heavy"
    | "shield"
    | "weapon"
    | "adventuring_gear";
  startingEquipment?: {
    itemIds?: string[];
    equippedArmorId?: string;
    equippedShieldId?: string;
    equippedWeaponId?: string;
  };
  abilityOptions?: BackgroundAbilityOptions;
  grantsFeat?: string;
  grantsOriginFeatId?: string;
  originFeatChoice?: {
    featIds?: string[];
  };
  category?: "origin" | "general";
  repeatable?: boolean;
  prerequisites?: {
    minLevel?: number;
    abilities?: Partial<Record<Ability, number>>;
    classIds?: string[];
    speciesIds?: string[];
    featureIds?: string[];
    requiresSpellcasting?: boolean;
  };
  classSkillChoices?: {
    count: number;
    from: string[];
  };
  weaponProficiencies?: {
    simple?: boolean;
    martial?: boolean;
    weaponIds?: string[];
  };
  weaponCategory?: "simple" | "martial";
  spellcasting?: {
    ability: Ability;
    progression: "full" | "half" | "third" | "pact";
    mode?: "prepared" | "known";
    selectionLimitsByLevel?: Array<{
      level: number;
      known?: number;
      prepared?: number;
      cantripsKnown?: number;
    }>;
  };
  spellListRefIds?: string[];
  spellListRefs?: string[];
};

type SpellSelectionField = "knownSpellIds" | "preparedSpellIds" | "cantripsKnownIds";

type BuilderOptions = {
  species: Option[];
  backgrounds: Option[];
  classes: Option[];
  armor: Option[];
  shields: Option[];
  weapons: Option[];
  adventuringGear: Option[];
};

type SourceManifest = {
  id: string;
  name: string;
  version: string;
  label: string;
};

type BuilderState = CharacterState;

type ExportedDerivedState = {
  level: number;
  subclass: string | null;
  xp: number | null;
  heroicInspiration: boolean;
  abilities: Record<Ability, number>;
  abilityModifiers: Record<Ability, number>;
  proficiencyBonus: number;
  passivePerception: number;
  skills: Record<string, number>;
  savingThrows: Record<Ability, number>;
  AC: number;
  shieldAC: number;
  HP: number;
  tempHP: number;
  hitDiceTotal: number | null;
  hitDiceSpent: number;
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  exhaustionLevel: number;
  speed: number;
  attacks: Array<{ name: string; toHit: number; damage: string; mastery?: string[] }>;
  feats: { id: string; name: string }[];
  background: string | null;
  class: string | null;
  species: string | null;
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];
  coins: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  otherWealth: string | null;
  attunedItems: AttunedItem[];
  appearance: string | null;
  physicalDescription: string | null;
  backstory: string | null;
  alignment: string | null;
  notes: string | null;
  companion: {
    name: string | null;
    type: string | null;
    summary: string | null;
    notes: string | null;
  } | null;
  familiar: {
    name: string | null;
    type: string | null;
    summary: string | null;
    notes: string | null;
  } | null;
  spellcastingAbility: Ability | null;
  spellcastingModifier: number | null;
  spellSaveDC: number | null;
  spellAttackBonus: number | null;
  spellSlots: DerivedState["spellSlots"];
  spellcasting?: DerivedState["spellcasting"];
  activeConditionIds?: DerivedState["activeConditionIds"];
  appliedModifiers?: DerivedState["appliedModifiers"];
  warnings: string[];
};

type BuilderClientProps = {
  manifests: SourceManifest[];
  enabledSourceIds: string[];
  sourcesParamPresent: boolean;
  content: MergedContent;
  options: BuilderOptions;
  mergeReport: unknown;
};

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];
const COIN_DENOMINATIONS: CoinDenomination[] = ["cp", "sp", "ep", "gp", "pp"];
const ATTUNEMENT_SLOT_COUNT = 5;
const SOURCE_STORAGE_KEY = "darksun-builder:sources";
const ABILITY_SCORE_METHOD_OPTIONS: Array<{ value: AbilityScoreMethod; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "standard_array", label: "Standard Array" },
  { value: "point_buy", label: "Point Buy" },
];

function makeDefaultAbilities(): Record<Ability, number> {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };
}

function makeStandardArrayAbilities(): Record<Ability, number> {
  return {
    str: STANDARD_ARRAY[0],
    dex: STANDARD_ARRAY[1],
    con: STANDARD_ARRAY[2],
    int: STANDARD_ARRAY[3],
    wis: STANDARD_ARRAY[4],
    cha: STANDARD_ARRAY[5],
  };
}

function normalizePointBuyScore(value: number): number {
  if (!Number.isFinite(value)) {
    return POINT_BUY_MIN_SCORE;
  }
  return Math.max(
    POINT_BUY_MIN_SCORE,
    Math.min(POINT_BUY_MAX_SCORE, Math.floor(value)),
  );
}

function normalizePointBuyAbilities(
  abilities: Record<Ability, number>,
): Record<Ability, number> {
  return {
    str: normalizePointBuyScore(abilities.str),
    dex: normalizePointBuyScore(abilities.dex),
    con: normalizePointBuyScore(abilities.con),
    int: normalizePointBuyScore(abilities.int),
    wis: normalizePointBuyScore(abilities.wis),
    cha: normalizePointBuyScore(abilities.cha),
  };
}

function parseSourceList(
  raw: string,
  validIds: string[],
): string[] {
  const validSet = new Set(validIds);
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && validSet.has(value));
  return Array.from(new Set(parsed));
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function collectArray(content: unknown, key: string): Option[] {
  const anyContent = content as Record<string, unknown>;

  if (Array.isArray(anyContent[key])) {
    return anyContent[key] as Option[];
  }

  const byId = anyContent[`${key}ById`] as Record<string, Option> | undefined;
  if (byId && typeof byId === "object") {
    return Object.values(byId);
  }

  const entities = anyContent.entities as Record<string, unknown> | undefined;
  if (entities && Array.isArray(entities[key])) {
    return entities[key] as Option[];
  }

  return [];
}

function labelFeat(feat: Option): string {
  if (!feat.category) {
    return feat.name;
  }
  return `${feat.name} (${feat.category})`;
}

function formatSkillId(skillId: string): string {
  return skillId
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function sortStringIds(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sortInventoryEntries(
  entries: Array<{ itemId: string; quantity?: number }>,
): Array<{ itemId: string; quantity?: number }> {
  return [...entries].sort((a, b) => a.itemId.localeCompare(b.itemId));
}

function normalizeAttunedItemsForExport(items: AttunedItem[] | undefined): AttunedItem[] {
  return (items ?? [])
    .map((item) => ({
      name: item.name?.trim() || undefined,
      itemId: item.itemId?.trim() || undefined,
      notes: item.notes?.trim() || undefined,
    }))
    .filter((item) => Boolean(item.name || item.itemId || item.notes));
}

function withSpellSelectionField(
  state: BuilderState,
  field: SpellSelectionField,
  nextIds: string[],
): BuilderState {
  if (field === "knownSpellIds") {
    return { ...state, knownSpellIds: nextIds };
  }
  if (field === "preparedSpellIds") {
    return { ...state, preparedSpellIds: nextIds };
  }
  return { ...state, cantripsKnownIds: nextIds };
}

function isFeatEligibleForState(
  feat: Option,
  state: BuilderState,
  derived: DerivedState,
  selectedFeatIds: Set<string>,
): boolean {
  if (feat.repeatable !== true && selectedFeatIds.has(feat.id)) {
    return false;
  }

  const prereq = feat.prerequisites;
  if (!prereq) {
    return true;
  }

  if (typeof prereq.minLevel === "number" && state.level < prereq.minLevel) {
    return false;
  }

  if (
    prereq.classIds &&
    prereq.classIds.length > 0 &&
    (!state.selectedClassId || !prereq.classIds.includes(state.selectedClassId))
  ) {
    return false;
  }

  if (
    prereq.speciesIds &&
    prereq.speciesIds.length > 0 &&
    (!state.selectedSpeciesId || !prereq.speciesIds.includes(state.selectedSpeciesId))
  ) {
    return false;
  }

  if (prereq.featureIds && prereq.featureIds.length > 0) {
    const selectedFeatureIds = new Set(state.selectedFeatureIds ?? []);
    const hasAllRequiredFeatures = prereq.featureIds.every((featureId) =>
      selectedFeatureIds.has(featureId),
    );
    if (!hasAllRequiredFeatures) {
      return false;
    }
  }

  if (
    prereq.requiresSpellcasting &&
    !derived.spellcastingAbility &&
    !derived.spellcasting
  ) {
    return false;
  }

  if (prereq.abilities) {
    const reqs = Object.entries(prereq.abilities).filter(
      (entry): entry is [Ability, number] => typeof entry[1] === "number",
    );
    for (const [ability, minimum] of reqs) {
      if ((derived.finalAbilities[ability] ?? 0) < minimum) {
        return false;
      }
    }
  }

  return true;
}

function downloadFile(filename: string, contents: BlobPart, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function encodePayloadToBase64Url(payload: unknown): string {
  const json = JSON.stringify(payload);
  const utf8 = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of utf8) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export default function BuilderClient({
  manifests,
  enabledSourceIds,
  sourcesParamPresent,
  content,
  options,
  mergeReport,
}: BuilderClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const manifestOrder = useMemo(() => manifests.map((manifest) => manifest.id), [manifests]);
  const [enabledSources, setEnabledSources] = useState<string[]>(enabledSourceIds);
  const [showDebug, setShowDebug] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const [state, setState] = useState<BuilderState>(() => ({
    level: 1,
    baseAbilities: makeDefaultAbilities(),
    abilityScoreMethod: "manual",
    selectedSpeciesId: undefined,
    selectedBackgroundId: undefined,
    selectedClassId: undefined,
    subclass: undefined,
    xp: 0,
    heroicInspiration: false,
    equippedArmorId: undefined,
    equippedShieldId: undefined,
    equippedWeaponId: undefined,
    armorProficiencies: [],
    weaponProficiencies: [],
    chosenSkillProficiencies: [],
    chosenClassSkills: [],
    chosenSaveProficiencies: [],
    toolProficiencies: [],
    languages: [],
    knownSpellIds: [],
    preparedSpellIds: [],
    cantripsKnownIds: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    otherWealth: "",
    tempHP: 0,
    hitDiceTotal: undefined,
    hitDiceSpent: 0,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    exhaustionLevel: 0,
    attunedItems: Array.from({ length: ATTUNEMENT_SLOT_COUNT }, () => ({
      name: "",
      itemId: "",
      notes: "",
    })),
    appearance: "",
    physicalDescription: "",
    backstory: "",
    alignment: "",
    notes: "",
    companion: {
      name: "",
      type: "",
      summary: "",
      notes: "",
    },
    familiar: {
      name: "",
      type: "",
      summary: "",
      notes: "",
    },
    inventoryItemIds: [],
    inventoryEntries: [],
    featSelections: {
      level: {},
    },
    selectedFeats: [],
    abilityIncreases: [],
    advancements: [],
  }));

  const [backgroundMode, setBackgroundMode] = useState<"2+1" | "1+1+1">("2+1");
  const [backgroundPlusTwo, setBackgroundPlusTwo] = useState<Ability>("str");
  const [backgroundPlusOne, setBackgroundPlusOne] = useState<Ability>("dex");

  const [slotModes, setSlotModes] = useState<Record<number, "feat" | "asi">>({});
  const [featDrafts, setFeatDrafts] = useState<Record<number, string>>({});
  const [asiDrafts, setAsiDrafts] = useState<Record<number, AbilityChanges>>({});

  useEffect(() => {
    setEnabledSources(enabledSourceIds);
  }, [enabledSourceIds]);

  useEffect(() => {
    if (sourcesParamPresent) {
      return;
    }

    const saved = window.localStorage.getItem(SOURCE_STORAGE_KEY);
    if (!saved) {
      window.localStorage.setItem(SOURCE_STORAGE_KEY, enabledSourceIds.join(","));
      return;
    }

    const parsed = parseSourceList(saved, manifestOrder);
    if (parsed.length === 0 || sameIds(parsed, enabledSourceIds)) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sources", parsed.join(","));
    router.replace(`${pathname}?${params.toString()}`);
  }, [
    enabledSourceIds,
    manifestOrder,
    pathname,
    router,
    searchParams,
    sourcesParamPresent,
  ]);

  const selectedBackground = useMemo(
    () => options.backgrounds.find((background) => background.id === state.selectedBackgroundId),
    [options.backgrounds, state.selectedBackgroundId],
  );
  const selectedSpecies = useMemo(
    () => options.species.find((species) => species.id === state.selectedSpeciesId),
    [options.species, state.selectedSpeciesId],
  );
  const selectedClass = useMemo(
    () => options.classes.find((entry) => entry.id === state.selectedClassId),
    [options.classes, state.selectedClassId],
  );
  const classSpellSelectionLimits = useMemo(() => {
    return selectedClass?.spellcasting?.selectionLimitsByLevel?.find(
      (entry) => entry.level === state.level,
    );
  }, [selectedClass?.spellcasting?.selectionLimitsByLevel, state.level]);
  const classSpellListRefIds = useMemo(
    () => selectedClass?.spellListRefIds ?? selectedClass?.spellListRefs ?? [],
    [selectedClass?.spellListRefIds, selectedClass?.spellListRefs],
  );
  const missingClassSpellListRefIds = useMemo(() => {
    return classSpellListRefIds.filter((spellListId) => !content.spellListsById[spellListId]);
  }, [classSpellListRefIds, content.spellListsById]);
  const availableClassSpells = useMemo(() => {
    const spellIds = Array.from(
      new Set(
        classSpellListRefIds.flatMap(
          (spellListId) => content.spellListsById[spellListId]?.spellIds ?? [],
        ),
      ),
    );

    return spellIds
      .map((spellId) => content.spellsById[spellId])
      .filter((spell): spell is Spell => Boolean(spell))
      .sort((a, b) => {
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        return a.name.localeCompare(b.name);
      });
  }, [classSpellListRefIds, content.spellListsById, content.spellsById]);
  const availableCantripSpells = useMemo(
    () => availableClassSpells.filter((spell) => spell.level === 0),
    [availableClassSpells],
  );
  const availableLeveledSpells = useMemo(
    () => availableClassSpells.filter((spell) => spell.level > 0),
    [availableClassSpells],
  );
  const selectedWeapon = useMemo(
    () => options.weapons.find((entry) => entry.id === state.equippedWeaponId),
    [options.weapons, state.equippedWeaponId],
  );
  const selectedClassSkillChoices = selectedClass?.classSkillChoices;
  const skillNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const skill of content.skillDefinitions ?? []) {
      map[skill.id] = skill.name;
    }
    return map;
  }, [content.skillDefinitions]);
  const chosenClassSkills = state.chosenClassSkills ?? [];
  const originFeats = useMemo(
    () => collectArray(content, "feats").filter((feat) => feat.category === "origin"),
    [content],
  );
  const selectedBackgroundOriginChoice = selectedBackground?.originFeatChoice;
  const selectedBackgroundFixedOriginFeatId =
    selectedBackground?.grantsOriginFeatId ?? selectedBackground?.grantsFeat;
  const derived = useMemo(
    () => computeDerivedState(state, content) as DerivedState,
    [content, state],
  );
  const skillAndToolRows = useMemo(() => {
    return getSkillAndToolDisplayRows({
      skillDefinitions: content.skillDefinitions,
      skills: derived.skills,
      toolProficiencies: derived.toolProficiencies,
    });
  }, [content.skillDefinitions, derived.skills, derived.toolProficiencies]);
  const selectedBackgroundFixedOriginFeat = selectedBackgroundFixedOriginFeatId
    ? originFeats.find((feat) => feat.id === selectedBackgroundFixedOriginFeatId)
    : undefined;
  const selectableOriginFeats = useMemo(() => {
    if (!selectedBackgroundOriginChoice) {
      return [];
    }
    const allowedIds = selectedBackgroundOriginChoice.featIds;
    const levelFeatSelections = state.featSelections?.level ?? {};
    const levelFeatAdvancements = (state.advancements ?? []).filter(
      (entry): entry is Extract<NonNullable<BuilderState["advancements"]>[number], { type: "feat" }> =>
        entry.type === "feat" && entry.source === "level",
    );
    const selectedIds = new Set<string>([
      ...(state.selectedFeats ?? []),
      ...Object.values(levelFeatSelections).filter(
        (featId): featId is string => typeof featId === "string" && featId.length > 0,
      ),
      ...levelFeatAdvancements.map((entry) => entry.featId),
    ]);
    const selectedOriginFeatId = state.featSelections?.origin ?? state.originFeatId;

    if (!allowedIds || allowedIds.length === 0) {
      return originFeats.filter(
        (feat) =>
          feat.id === selectedOriginFeatId ||
          isFeatEligibleForState(feat, state, derived, selectedIds),
      );
    }
    const allowedSet = new Set(allowedIds);
    return originFeats.filter(
      (feat) =>
        allowedSet.has(feat.id) &&
        (feat.id === selectedOriginFeatId ||
          isFeatEligibleForState(feat, state, derived, selectedIds)),
    );
  }, [derived, originFeats, selectedBackgroundOriginChoice, state]);

  useEffect(() => {
    const available = selectedBackground?.abilityOptions?.abilities ?? [];
    if (available.length === 0) {
      setState((previous) => ({
        ...previous,
        abilityIncreases: (previous.abilityIncreases ?? []).filter(
          (entry) => entry.source !== "background",
        ),
      }));
      return;
    }

    setBackgroundPlusTwo(available[0] ?? "str");
    setBackgroundPlusOne(available[1] ?? available[0] ?? "dex");
  }, [selectedBackground?.id, selectedBackground?.abilityOptions?.abilities]);

  useEffect(() => {
    const abilityOptions = selectedBackground?.abilityOptions;
    if (!abilityOptions) {
      return;
    }

    const changes: AbilityChanges = {};
    if (backgroundMode === "1+1+1") {
      for (const ability of abilityOptions.abilities) {
        changes[ability] = (changes[ability] ?? 0) + 1;
      }
    } else if (backgroundPlusTwo && backgroundPlusOne && backgroundPlusTwo !== backgroundPlusOne) {
      changes[backgroundPlusTwo] = (changes[backgroundPlusTwo] ?? 0) + 2;
      changes[backgroundPlusOne] = (changes[backgroundPlusOne] ?? 0) + 1;
    }

    setState((previous) => {
      const withoutBackground = (previous.abilityIncreases ?? []).filter(
        (entry) => entry.source !== "background",
      );

      const hasChanges = Object.values(changes).some((value) => typeof value === "number" && value > 0);
      const nextAbilityIncreases = hasChanges
        ? [...withoutBackground, { source: "background" as const, changes }]
        : withoutBackground;

      const previousBackground = (previous.abilityIncreases ?? []).find(
        (entry) => entry.source === "background",
      );

      if (
        JSON.stringify(previousBackground?.changes ?? {}) === JSON.stringify(changes) &&
        (previous.abilityIncreases ?? []).length === nextAbilityIncreases.length
      ) {
        return previous;
      }

      return {
        ...previous,
        abilityIncreases: nextAbilityIncreases,
      };
    });
  }, [backgroundMode, backgroundPlusOne, backgroundPlusTwo, selectedBackground?.abilityOptions]);

  useEffect(() => {
    setState((previous) => {
      const current = Array.from(new Set(previous.chosenClassSkills ?? []));
      if (!selectedClassSkillChoices) {
        if (current.length === 0) {
          return previous;
        }
        return { ...previous, chosenClassSkills: [] };
      }

      const allowed = new Set(selectedClassSkillChoices.from);
      const normalized = current
        .filter((skill) => allowed.has(skill))
        .slice(0, selectedClassSkillChoices.count);

      if (JSON.stringify(current) === JSON.stringify(normalized)) {
        return previous;
      }

      return { ...previous, chosenClassSkills: normalized };
    });
  }, [selectedClassSkillChoices]);

  useEffect(() => {
    setState((previous) => {
      const fixedOriginFeatId =
        selectedBackground?.grantsOriginFeatId ?? selectedBackground?.grantsFeat;
      if (fixedOriginFeatId) {
        const currentOriginFeatId = previous.featSelections?.origin ?? previous.originFeatId;
        if (currentOriginFeatId === fixedOriginFeatId) {
          return previous;
        }
        return {
          ...previous,
          originFeatId: fixedOriginFeatId,
          featSelections: {
            ...(previous.featSelections ?? {}),
            origin: fixedOriginFeatId,
          },
        };
      }

      if (selectedBackgroundOriginChoice) {
        const allowedIds =
          selectedBackgroundOriginChoice.featIds && selectedBackgroundOriginChoice.featIds.length > 0
            ? new Set(selectedBackgroundOriginChoice.featIds)
            : new Set(originFeats.map((feat) => feat.id));

        const currentOriginFeatId = previous.featSelections?.origin ?? previous.originFeatId;
        if (currentOriginFeatId && allowedIds.has(currentOriginFeatId)) {
          return previous;
        }
        if (currentOriginFeatId === undefined) {
          return previous;
        }
        return {
          ...previous,
          originFeatId: undefined,
          featSelections: {
            ...(previous.featSelections ?? {}),
            origin: undefined,
          },
        };
      }

      const currentOriginFeatId = previous.featSelections?.origin ?? previous.originFeatId;
      if (currentOriginFeatId === undefined) {
        return previous;
      }
      return {
        ...previous,
        originFeatId: undefined,
        featSelections: {
          ...(previous.featSelections ?? {}),
          origin: undefined,
        },
      };
    });
  }, [originFeats, selectedBackground?.grantsFeat, selectedBackground?.grantsOriginFeatId, selectedBackgroundOriginChoice]);

  useEffect(() => {
    setState((previous) => {
      const valid = <T extends { id: string }>(id: string | undefined, list: T[]): string | undefined => {
        if (id && list.some((item) => item.id === id)) {
          return id;
        }
        return undefined;
      };

      return {
        ...previous,
        selectedSpeciesId: valid(previous.selectedSpeciesId, options.species),
        selectedBackgroundId: valid(previous.selectedBackgroundId, options.backgrounds),
        selectedClassId: valid(previous.selectedClassId, options.classes),
        equippedArmorId: valid(previous.equippedArmorId, options.armor),
        equippedShieldId: valid(previous.equippedShieldId, options.shields),
        equippedWeaponId: valid(previous.equippedWeaponId, options.weapons),
      };
    });
  }, [options]);

  useEffect(() => {
    setState((previous) => {
      const allowedSlots = new Set(
        getAvailableAdvancementSlots(previous.level, previous.selectedClassId),
      );
      const levelSelections = previous.featSelections?.level ?? {};
      const nextLevelSelections: Record<number, string> = {};
      for (const [key, value] of Object.entries(levelSelections)) {
        const slotLevel = Number(key);
        if (!Number.isFinite(slotLevel) || !allowedSlots.has(slotLevel)) {
          continue;
        }
        nextLevelSelections[slotLevel] = value;
      }
      const nextAdvancements = (previous.advancements ?? []).filter(
        (entry) => entry.source !== "level" || allowedSlots.has(entry.level),
      );

      const levelSelectionsChanged =
        JSON.stringify(levelSelections) !== JSON.stringify(nextLevelSelections);
      const advancementsChanged =
        JSON.stringify(previous.advancements ?? []) !== JSON.stringify(nextAdvancements);

      if (!levelSelectionsChanged && !advancementsChanged) {
        return previous;
      }

      return {
        ...previous,
        featSelections: {
          ...(previous.featSelections ?? {}),
          level: nextLevelSelections,
        },
        advancements: nextAdvancements,
      };
    });
  }, [state.level, state.selectedClassId]);

  const validation = useMemo<ValidationReport>(
    () => validateCharacter(state, content),
    [content, state],
  );

  const feats = useMemo(() => {
    return collectArray(content, "feats").sort((a, b) => a.name.localeCompare(b.name));
  }, [content]);
  const levelEligibleFeatsBySlot = useMemo(() => {
    const slotLevels = getAvailableAdvancementSlots(state.level, state.selectedClassId);
    const levelSelections = state.featSelections?.level ?? {};
    const levelFeatAdvancements = (state.advancements ?? []).filter(
      (entry): entry is Extract<NonNullable<BuilderState["advancements"]>[number], { type: "feat" }> =>
        entry.type === "feat" && entry.source === "level",
    );
    const chosenOriginFeatId = state.featSelections?.origin ?? state.originFeatId;

    return Object.fromEntries(
      slotLevels.map((slotLevel) => {
        const otherSlotFeatIds = Object.entries(levelSelections)
          .filter(
            ([rawLevel, featId]) =>
              Number(rawLevel) !== slotLevel &&
              typeof featId === "string" &&
              featId.length > 0,
          )
          .map(([, featId]) => featId as string);
        const otherAdvancementFeatIds = levelFeatAdvancements
          .filter((entry) => entry.level !== slotLevel)
          .map((entry) => entry.featId);
        const selectedIds = new Set<string>([
          ...(state.selectedFeats ?? []),
          ...otherSlotFeatIds,
          ...otherAdvancementFeatIds,
          ...(selectedBackgroundFixedOriginFeatId ? [selectedBackgroundFixedOriginFeatId] : []),
          ...(selectedBackgroundOriginChoice && chosenOriginFeatId ? [chosenOriginFeatId] : []),
        ]);
        const currentSlotFeatId =
          levelSelections[slotLevel] ??
          levelFeatAdvancements.find((entry) => entry.level === slotLevel)?.featId;

        const eligible = feats.filter(
          (feat) =>
            feat.category !== "origin" &&
            (feat.id === currentSlotFeatId ||
              isFeatEligibleForState(feat, state, derived, selectedIds)),
        );
        return [slotLevel, eligible];
      }),
    ) as Record<number, Option[]>;
  }, [
    derived,
    feats,
    selectedBackgroundFixedOriginFeatId,
    selectedBackgroundOriginChoice,
    state,
  ]);

  const exportedDerivedState = useMemo<ExportedDerivedState>(
    () => {
      const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
      const coinValues = state.coins ?? {};
      const coin = (denomination: CoinDenomination): number => {
        const value = coinValues[denomination];
        if (!Number.isFinite(value)) {
          return 0;
        }
        return Math.max(0, Math.floor(value ?? 0));
      };
      const hitDiceTotal = Number.isFinite(state.hitDiceTotal)
        ? Math.max(0, Math.floor(state.hitDiceTotal ?? 0))
        : null;
      const rawHitDiceSpent = Number.isFinite(state.hitDiceSpent)
        ? Math.max(0, Math.floor(state.hitDiceSpent ?? 0))
        : 0;
      const hitDiceSpent =
        hitDiceTotal === null
          ? rawHitDiceSpent
          : Math.min(rawHitDiceSpent, hitDiceTotal);
      const exhaustionLevel = Number.isFinite(state.exhaustionLevel)
        ? Math.max(0, Math.min(10, Math.floor(state.exhaustionLevel ?? 0)))
        : 0;
      return {
        level: Math.max(1, Math.floor(state.level || 1)),
        subclass: state.subclass ?? null,
        xp: Number.isFinite(state.xp) ? Math.max(0, Math.floor(state.xp ?? 0)) : null,
        heroicInspiration: state.heroicInspiration === true,
        abilities: derived.finalAbilities,
        abilityModifiers: derived.abilityMods,
        proficiencyBonus: derived.proficiencyBonus,
        passivePerception: derived.passivePerception,
        skills: derived.skills,
        savingThrows: derived.savingThrows,
        AC: derived.armorClass,
        shieldAC: state.equippedShieldId ? 2 : 0,
        HP: derived.maxHP,
        tempHP: Number.isFinite(state.tempHP) ? Math.max(0, Math.floor(state.tempHP ?? 0)) : 0,
        hitDiceTotal,
        hitDiceSpent,
        deathSaveSuccesses: Number.isFinite(state.deathSaveSuccesses)
          ? Math.max(0, Math.min(3, Math.floor(state.deathSaveSuccesses ?? 0)))
          : 0,
        deathSaveFailures: Number.isFinite(state.deathSaveFailures)
          ? Math.max(0, Math.min(3, Math.floor(state.deathSaveFailures ?? 0)))
          : 0,
        exhaustionLevel,
        speed: derived.speed,
        attacks: derived.attack ? [derived.attack] : [],
        feats: derived.feats,
        background: selectedBackground?.name ?? null,
        class: selectedClass?.name ?? null,
        species: selectedSpecies?.name ?? null,
        armorProficiencies: sortStringIds(state.armorProficiencies ?? []),
        weaponProficiencies: sortStringIds(state.weaponProficiencies ?? []),
        toolProficiencies: derived.toolProficiencies,
        languages: derived.languages,
        coins: {
          cp: coin("cp"),
          sp: coin("sp"),
          ep: coin("ep"),
          gp: coin("gp"),
          pp: coin("pp"),
        },
        otherWealth: state.otherWealth?.trim() ? state.otherWealth.trim() : null,
        attunedItems: normalizeAttunedItemsForExport(state.attunedItems),
        appearance: state.appearance?.trim() ? state.appearance.trim() : null,
        physicalDescription: state.physicalDescription?.trim() ? state.physicalDescription.trim() : null,
        backstory: state.backstory?.trim() ? state.backstory.trim() : null,
        alignment: state.alignment?.trim() ? state.alignment.trim() : null,
        notes: state.notes?.trim() ? state.notes.trim() : null,
        companion: state.companion
          ? {
              name: state.companion.name?.trim() ? state.companion.name.trim() : null,
              type: state.companion.type?.trim() ? state.companion.type.trim() : null,
              summary: state.companion.summary?.trim() ? state.companion.summary.trim() : null,
              notes: state.companion.notes?.trim() ? state.companion.notes.trim() : null,
            }
          : null,
        familiar: state.familiar
          ? {
              name: state.familiar.name?.trim() ? state.familiar.name.trim() : null,
              type: state.familiar.type?.trim() ? state.familiar.type.trim() : null,
              summary: state.familiar.summary?.trim() ? state.familiar.summary.trim() : null,
              notes: state.familiar.notes?.trim() ? state.familiar.notes.trim() : null,
            }
          : null,
        spellcastingAbility,
        spellcastingModifier: spellcastingAbility ? derived.abilityMods[spellcastingAbility] : null,
        spellSaveDC: derived.spellSaveDC,
        spellAttackBonus: derived.spellAttackBonus,
        spellSlots: derived.spellSlots,
        spellcasting: derived.spellcasting,
        activeConditionIds: derived.activeConditionIds,
        appliedModifiers: derived.appliedModifiers,
        warnings: derived.warnings,
      };
    },
    [derived, selectedBackground?.name, selectedClass?.name, selectedSpecies?.name, state],
  );

  const advancementSlots = (derived.advancementSlots ?? []) as Array<Record<string, unknown>>;
  const missingAdvancementSlotLevels = advancementSlots
    .filter((slot) => !Boolean(slot.filled))
    .map((slot) => Number(slot.level ?? 0))
    .filter((slotLevel) => Number.isFinite(slotLevel));
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus = derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;
  const startingEquipment = derived.startingEquipment;
  const hasStartingEquipmentSuggestions = Boolean(
    startingEquipment?.equippedArmorId ||
      startingEquipment?.equippedShieldId ||
      startingEquipment?.equippedWeaponId,
  );
  const knownSpellLimit = classSpellSelectionLimits?.known;
  const preparedSpellLimit = classSpellSelectionLimits?.prepared;
  const cantripsKnownLimit = classSpellSelectionLimits?.cantripsKnown;
  const spellSelectionBuckets: Array<{
    field: SpellSelectionField;
    label: string;
    selectedIds: string[];
    availableSpells: Spell[];
    maxCount: number | undefined;
  }> = [
    {
      field: "cantripsKnownIds",
      label: "Cantrips Known",
      selectedIds: state.cantripsKnownIds ?? [],
      availableSpells: availableCantripSpells,
      maxCount: cantripsKnownLimit,
    },
    {
      field: "knownSpellIds",
      label: "Known Spells",
      selectedIds: state.knownSpellIds ?? [],
      availableSpells: availableLeveledSpells,
      maxCount: knownSpellLimit,
    },
    {
      field: "preparedSpellIds",
      label: "Prepared Spells",
      selectedIds: state.preparedSpellIds ?? [],
      availableSpells: availableLeveledSpells,
      maxCount: preparedSpellLimit,
    },
  ];
  const abilityScoreMethod = state.abilityScoreMethod ?? "manual";
  const pointBuySpent = useMemo(() => computePointBuyCost(state.baseAbilities), [state.baseAbilities]);
  const pointBuyRemaining = pointBuySpent === null ? null : POINT_BUY_BUDGET - pointBuySpent;
  const hitDiceTotalForConstraints = Number.isFinite(state.hitDiceTotal)
    ? Math.max(0, Math.floor(state.hitDiceTotal ?? 0))
    : null;
  const attunementSlots = useMemo(() => {
    const normalized = [...(state.attunedItems ?? [])];
    if (normalized.length > ATTUNEMENT_SLOT_COUNT) {
      return normalized.slice(0, ATTUNEMENT_SLOT_COUNT);
    }
    while (normalized.length < ATTUNEMENT_SLOT_COUNT) {
      normalized.push({
        name: "",
        itemId: "",
        notes: "",
      });
    }
    return normalized;
  }, [state.attunedItems]);
  const standardArrayAllowedCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const value of STANDARD_ARRAY) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  }, []);
  const standardArrayAssignedCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const ability of ABILITIES) {
      const score = state.baseAbilities[ability];
      counts.set(score, (counts.get(score) ?? 0) + 1);
    }
    return counts;
  }, [state.baseAbilities]);

  const applySources = (nextEnabledIds: string[]) => {
    const ordered = manifestOrder.filter((id) => nextEnabledIds.includes(id));
    setEnabledSources(ordered);
    window.localStorage.setItem(SOURCE_STORAGE_KEY, ordered.join(","));

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sources", ordered.join(","));
    router.push(`${pathname}?${params.toString()}`);
  };

  const onToggleSource = (id: string, checked: boolean) => {
    const next = new Set(enabledSources);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    if (next.size === 0) {
      return;
    }
    applySources(Array.from(next));
  };

  const updateAbility = (ability: Ability, value: number) => {
    setState((previous) => ({
      ...previous,
      baseAbilities: {
        ...previous.baseAbilities,
        [ability]: value,
      },
    }));
  };

  const setAbilityScoreMethod = (method: AbilityScoreMethod) => {
    setState((previous) => {
      if ((previous.abilityScoreMethod ?? "manual") === method) {
        return previous;
      }

      let nextBaseAbilities = previous.baseAbilities;
      if (method === "standard_array") {
        nextBaseAbilities = makeStandardArrayAbilities();
      } else if (method === "point_buy") {
        nextBaseAbilities = normalizePointBuyAbilities(previous.baseAbilities);
      }

      return {
        ...previous,
        abilityScoreMethod: method,
        baseAbilities: nextBaseAbilities,
      };
    });
  };

  const updatePointBuyAbility = (ability: Ability, value: number) => {
    setState((previous) => ({
      ...previous,
      baseAbilities: {
        ...previous.baseAbilities,
        [ability]: normalizePointBuyScore(value),
      },
    }));
  };

  const normalizeInteger = (value: number, minimum = 0, maximum?: number): number => {
    const floored = Number.isFinite(value) ? Math.floor(value) : minimum;
    const boundedMinimum = Math.max(minimum, floored);
    if (typeof maximum === "number") {
      return Math.min(maximum, boundedMinimum);
    }
    return boundedMinimum;
  };

  const updateCoin = (denomination: CoinDenomination, value: number) => {
    setState((previous) => ({
      ...previous,
      coins: {
        ...(previous.coins ?? {}),
        [denomination]: normalizeInteger(value),
      },
    }));
  };

  const updateAttunedItem = (index: number, field: "name" | "itemId" | "notes", value: string) => {
    setState((previous) => {
      const items = [...(previous.attunedItems ?? [])];
      while (items.length <= index) {
        items.push({});
      }
      const current = items[index] ?? {};
      items[index] = {
        ...current,
        [field]: value,
      };
      return {
        ...previous,
        attunedItems: items,
      };
    });
  };

  const updateEncumberedCondition = (active: boolean) => {
    setState((previous) => ({
      ...previous,
      conditions: {
        ...(previous.conditions ?? {}),
        encumbered: active,
      },
    }));
  };

  const onToggleAdventuringGear = (itemId: string, checked: boolean) => {
    setState((previous) => {
      const inventoryEntries = previous.inventoryEntries ?? [];
      const inventoryItemIds = previous.inventoryItemIds ?? [];

      if (checked) {
        if (inventoryEntries.some((entry) => entry.itemId === itemId)) {
          return previous;
        }
        return {
          ...previous,
          inventoryItemIds: inventoryItemIds.filter((id) => id !== itemId),
          inventoryEntries: sortInventoryEntries([
            ...inventoryEntries,
            {
              itemId,
              quantity: 1,
            },
          ]),
        };
      }

      const nextEntries = inventoryEntries.filter((entry) => entry.itemId !== itemId);
      const nextIds = inventoryItemIds.filter((id) => id !== itemId);
      if (
        nextEntries.length === inventoryEntries.length &&
        nextIds.length === inventoryItemIds.length
      ) {
        return previous;
      }

      return {
        ...previous,
        inventoryItemIds: nextIds,
        inventoryEntries: nextEntries,
      };
    });
  };

  const onSetAdventuringGearQuantity = (itemId: string, quantity: number) => {
    setState((previous) => {
      const normalized = Math.max(1, Math.floor(quantity || 1));
      const inventoryEntries = previous.inventoryEntries ?? [];
      const current = inventoryEntries.find((entry) => entry.itemId === itemId);
      if (current && current.quantity === normalized) {
        return previous;
      }

      const nextEntries = current
        ? inventoryEntries.map((entry) =>
            entry.itemId === itemId ? { ...entry, quantity: normalized } : entry,
          )
        : [...inventoryEntries, { itemId, quantity: normalized }];

      return {
        ...previous,
        inventoryItemIds: (previous.inventoryItemIds ?? []).filter((id) => id !== itemId),
        inventoryEntries: sortInventoryEntries(nextEntries),
      };
    });
  };

  const setLevelFeatSelection = (level: number, featId: string) => {
    setState((previous) => {
      const levelSelections = { ...(previous.featSelections?.level ?? {}) };
      levelSelections[level] = featId;
      return {
        ...previous,
        featSelections: {
          ...(previous.featSelections ?? {}),
          level: levelSelections,
        },
        advancements: (previous.advancements ?? []).filter(
          (entry) => !(entry.source === "level" && entry.level === level && entry.type === "feat"),
        ),
      };
    });
  };

  const upsertAsiAdvancement = (level: number, changes: AbilityChanges) => {
    setState((previous) => {
      const existing = (previous.advancements ?? []).filter(
        (entry) => !(entry.source === "level" && entry.level === level),
      );
      const levelSelections = { ...(previous.featSelections?.level ?? {}) };
      delete levelSelections[level];
      return {
        ...previous,
        featSelections: {
          ...(previous.featSelections ?? {}),
          level: levelSelections,
        },
        advancements: [
          ...existing,
          {
            type: "asi" as const,
            changes,
            source: "level" as const,
            level,
          },
        ].sort((a, b) => a.level - b.level),
      };
    });
  };

  const clearAdvancement = (level: number) => {
    setState((previous) => {
      const levelSelections = { ...(previous.featSelections?.level ?? {}) };
      delete levelSelections[level];
      return {
        ...previous,
        featSelections: {
          ...(previous.featSelections ?? {}),
          level: levelSelections,
        },
        advancements: (previous.advancements ?? []).filter(
          (entry) => !(entry.source === "level" && entry.level === level),
        ),
      };
    });
  };

  const onToggleClassSkill = (skillId: string, checked: boolean) => {
    const choices = selectedClassSkillChoices;
    if (!choices) {
      return;
    }

    setState((previous) => {
      const current = new Set(previous.chosenClassSkills ?? []);
      if (checked) {
        if (!current.has(skillId) && current.size >= choices.count) {
          return previous;
        }
        current.add(skillId);
      } else {
        current.delete(skillId);
      }

      return {
        ...previous,
        chosenClassSkills: Array.from(current),
        touched: {
          ...(previous.touched ?? {}),
          classSkills: true,
        },
      };
    });
  };

  const onToggleSpellSelection = (
    field: SpellSelectionField,
    spellId: string,
    checked: boolean,
    maxCount: number | undefined,
  ) => {
    setState((previous) => {
      const next = new Set(previous[field] ?? []);

      if (checked) {
        if (next.has(spellId)) {
          return previous;
        }
        if (typeof maxCount === "number" && next.size >= maxCount) {
          return previous;
        }
        next.add(spellId);
      } else {
        if (!next.has(spellId)) {
          return previous;
        }
        next.delete(spellId);
      }

      return withSpellSelectionField(previous, field, sortStringIds(Array.from(next)));
    });
  };

  const onDownloadJson = () => {
    const payload = {
      state,
      derived: exportedDerivedState,
      validation,
      enabledPackIds: enabledSources,
      generatedAt: new Date().toISOString(),
    };
    downloadFile("character-sheet.json", `${JSON.stringify(payload, null, 2)}\n`, "application/json");
    setExportNotice("JSON exported with validation report.");
  };

  const onOpenHtmlSheet = () => {
    const payload = encodePayloadToBase64Url({
      characterState: state,
      enabledPackIds: enabledSources,
      generatedAt: new Date().toISOString(),
    });
    const url = `/sheet?payload=${encodeURIComponent(payload)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) {
      setExportNotice("Opened HTML sheet in a new tab.");
      return;
    }
    window.location.assign(url);
    setExportNotice("Opened HTML sheet.");
  };

  const onDownloadPdf = async () => {
    if (!validation.isValidForExport) {
      const message = validation.errors
        .map((issue) => `- [${issue.code}] ${issue.message}`)
        .join("\n");
      setExportNotice("PDF export blocked: resolve validation errors first.");
      window.alert(`Cannot export PDF until validation errors are fixed:\n\n${message}`);
      return;
    }

    if (validation.warnings.length > 0) {
      const message = validation.warnings
        .map((issue) => `- [${issue.code}] ${issue.message}`)
        .join("\n");
      setExportNotice("Warnings present. PDF export allowed.");
      window.alert(`Warnings present:\n\n${message}`);
    } else {
      setExportNotice(null);
    }

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          characterState: state,
          enabledPackIds: enabledSources,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        const errorMessage =
          typeof errorPayload?.error === "string"
            ? errorPayload.error
            : "PDF export failed on server.";
        setExportNotice("PDF export failed.");
        window.alert(errorMessage);
        return;
      }

      const pdfBytes = new Uint8Array(await response.arrayBuffer());
      if (pdfBytes.byteLength === 0) {
        setExportNotice("PDF export failed.");
        window.alert("PDF export failed: server returned an empty file.");
        return;
      }

      downloadFile("character-sheet.pdf", pdfBytes, "application/pdf");
      setExportNotice("PDF exported.");
    } catch {
      setExportNotice("PDF export failed.");
      window.alert("PDF export failed: network or server error.");
    }
  };

  const onApplyStartingEquipment = () => {
    if (!startingEquipment) {
      return;
    }

    setState((previous) => {
      const nextArmorId =
        startingEquipment.equippedArmorId &&
        options.armor.some((item) => item.id === startingEquipment.equippedArmorId)
          ? startingEquipment.equippedArmorId
          : previous.equippedArmorId;
      const nextShieldId =
        startingEquipment.equippedShieldId &&
        options.shields.some((item) => item.id === startingEquipment.equippedShieldId)
          ? startingEquipment.equippedShieldId
          : previous.equippedShieldId;
      const nextWeaponId =
        startingEquipment.equippedWeaponId &&
        options.weapons.some((item) => item.id === startingEquipment.equippedWeaponId)
          ? startingEquipment.equippedWeaponId
          : previous.equippedWeaponId;

      if (
        nextArmorId === previous.equippedArmorId &&
        nextShieldId === previous.equippedShieldId &&
        nextWeaponId === previous.equippedWeaponId &&
        JSON.stringify(previous.inventoryItemIds ?? []) ===
          JSON.stringify(
            sortStringIds(
              Array.from(
                new Set([
                  ...(previous.inventoryItemIds ?? []),
                  ...(startingEquipment.itemIds ?? []),
                ]),
              ),
            ),
          )
      ) {
        return previous;
      }

      const nextInventoryItemIds = sortStringIds(
        Array.from(
          new Set([...(previous.inventoryItemIds ?? []), ...(startingEquipment.itemIds ?? [])]),
        ),
      );

      return {
        ...previous,
        equippedArmorId: nextArmorId,
        equippedShieldId: nextShieldId,
        equippedWeaponId: nextWeaponId,
        inventoryItemIds: nextInventoryItemIds,
      };
    });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h1 className="text-2xl font-semibold">Builder</h1>
        <p className="mt-1 text-sm text-slate-300">
          Select sources, then configure your character and review derived stats.
        </p>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Export</h2>
        <p className="mt-1 text-sm text-slate-300">
          Download machine-readable data or a template-based printable PDF.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenHtmlSheet}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Open HTML Sheet
          </button>
          <button
            type="button"
            onClick={onDownloadJson}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            Download PDF
          </button>
        </div>
        {exportNotice ? <p className="mt-2 text-sm text-amber-300">{exportNotice}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Validation</h2>
        <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded border border-slate-700 p-2">
            <div className="text-xs text-slate-300">Errors</div>
            <div className="text-lg font-semibold">{validation.errors.length}</div>
          </div>
          <div className="rounded border border-slate-700 p-2">
            <div className="text-xs text-slate-300">Warnings</div>
            <div className="text-lg font-semibold">{validation.warnings.length}</div>
          </div>
          <div className="rounded border border-slate-700 p-2">
            <div className="text-xs text-slate-300">Export Ready</div>
            <div className="text-lg font-semibold">{validation.isValidForExport ? "YES" : "NO"}</div>
          </div>
        </div>
        {validation.errors.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-300">
            {validation.errors.map((issue, index) => (
              <li key={`validation-error-${index}`}>
                [{issue.code}] {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        {validation.warnings.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-300">
            {validation.warnings.map((issue, index) => (
              <li key={`validation-warning-${index}`}>
                [{issue.code}] {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Sources</h2>
        <div className="mt-3 grid gap-2">
          {manifests.map((manifest) => {
            const checked = enabledSources.includes(manifest.id);
            return (
              <label key={manifest.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onToggleSource(manifest.id, event.target.checked)}
                />
                <span>{manifest.label}</span>
                <span className="text-xs text-slate-400">({manifest.id})</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="text-sm">
            <div className="font-semibold">Level</div>
            <input
              type="number"
              min={1}
              max={20}
              value={state.level}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  level: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                }))
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            />
          </label>

          <label className="text-sm">
            <div className="font-semibold">Ability Score Method</div>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={abilityScoreMethod}
              onChange={(event) => setAbilityScoreMethod(event.target.value as AbilityScoreMethod)}
            >
              {ABILITY_SCORE_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {abilityScoreMethod === "standard_array" ? (
            <p className="text-xs text-slate-300">Assign each value once: 15, 14, 13, 12, 10, 8.</p>
          ) : null}

          {abilityScoreMethod === "point_buy" ? (
            <div className="rounded border border-slate-700 bg-slate-950/60 p-2 text-xs">
              <div>Budget: {POINT_BUY_BUDGET}</div>
              <div>Spent: {pointBuySpent ?? "invalid"}</div>
              <div className={pointBuyRemaining !== null && pointBuyRemaining < 0 ? "text-rose-300" : ""}>
                Remaining: {pointBuyRemaining ?? "invalid"}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {ABILITIES.map((ability) => {
            if (abilityScoreMethod === "standard_array") {
              return (
                <label key={ability} className="text-sm">
                  <div className="font-semibold uppercase">{ability}</div>
                  <select
                    value={state.baseAbilities[ability]}
                    onChange={(event) => updateAbility(ability, Number(event.target.value))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  >
                    {STANDARD_ARRAY.map((value) => {
                      const assignedCount = standardArrayAssignedCounts.get(value) ?? 0;
                      const allowedCount = standardArrayAllowedCounts.get(value) ?? 0;
                      const isCurrentValue = state.baseAbilities[ability] === value;
                      const disabled = !isCurrentValue && assignedCount >= allowedCount;
                      return (
                        <option key={`${ability}-standard-${value}`} value={value} disabled={disabled}>
                          {value}
                        </option>
                      );
                    })}
                  </select>
                </label>
              );
            }

            if (abilityScoreMethod === "point_buy") {
              const score = state.baseAbilities[ability];
              const cost = getPointBuyScoreCost(score);
              return (
                <label key={ability} className="text-sm">
                  <div className="flex items-center justify-between font-semibold uppercase">
                    <span>{ability}</span>
                    <span className="text-xs text-slate-400">{cost !== null ? `${cost} pts` : "invalid"}</span>
                  </div>
                  <input
                    type="number"
                    min={POINT_BUY_MIN_SCORE}
                    max={POINT_BUY_MAX_SCORE}
                    value={score}
                    onChange={(event) => updatePointBuyAbility(ability, Number(event.target.value))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
              );
            }

            return (
              <label key={ability} className="text-sm">
                <div className="font-semibold uppercase">{ability}</div>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={state.baseAbilities[ability]}
                  onChange={(event) => updateAbility(ability, Number(event.target.value) || 1)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                />
              </label>
            );
          })}
        </div>
      </section>

      {derived.warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-600 bg-amber-950/40 p-4">
          <h2 className="text-sm font-semibold text-amber-200">Rules Warnings</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">
            {derived.warnings.map((warning, index) => (
              <li key={`warning-${index}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-3">
        <label className="text-sm">
          <div className="font-semibold">Species</div>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={state.selectedSpeciesId ?? ""}
            onChange={(event) =>
              setState((previous) => ({ ...previous, selectedSpeciesId: event.target.value || undefined }))
            }
          >
            <option value="">None</option>
            {options.species.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="font-semibold">Background</div>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={state.selectedBackgroundId ?? ""}
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                selectedBackgroundId: event.target.value || undefined,
                originFeatId: undefined,
                featSelections: {
                  ...(previous.featSelections ?? {}),
                  origin: undefined,
                },
              }))
            }
          >
            <option value="">None</option>
            {options.backgrounds.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="font-semibold">Class</div>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={state.selectedClassId ?? ""}
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                selectedClassId: event.target.value || undefined,
                chosenClassSkills: [],
                touched: {
                  ...(previous.touched ?? {}),
                  classSkills: false,
                },
              }))
            }
          >
            <option value="">None</option>
            {options.classes.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="font-semibold">Armor</div>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={state.equippedArmorId ?? ""}
            onChange={(event) =>
              setState((previous) => ({ ...previous, equippedArmorId: event.target.value || undefined }))
            }
          >
            <option value="">None</option>
            {options.armor.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="font-semibold">Shield</div>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={state.equippedShieldId ?? ""}
            onChange={(event) =>
              setState((previous) => ({ ...previous, equippedShieldId: event.target.value || undefined }))
            }
          >
            <option value="">None</option>
            {options.shields.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="font-semibold">Weapon</div>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={state.equippedWeaponId ?? ""}
            onChange={(event) =>
              setState((previous) => ({ ...previous, equippedWeaponId: event.target.value || undefined }))
            }
          >
            <option value="">None</option>
            {options.weapons.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm md:col-span-3">
          <div className="font-semibold">Identity & Combat Tracking</div>
          <div className="mt-1 grid gap-2 md:grid-cols-3">
            <label className="text-sm">
              <div className="font-semibold">Subclass</div>
              <input
                type="text"
                value={state.subclass ?? ""}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    subclass: event.target.value.trim() ? event.target.value : undefined,
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                placeholder="e.g. Berserker"
              />
            </label>

            <label className="text-sm">
              <div className="font-semibold">XP</div>
              <input
                type="number"
                min={0}
                value={state.xp ?? 0}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    xp: normalizeInteger(Number(event.target.value)),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>

            <div className="rounded border border-slate-700 bg-slate-950/30 px-2 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.heroicInspiration === true}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      heroicInspiration: event.target.checked,
                    }))
                  }
                />
                <span className="font-semibold">Heroic Inspiration</span>
              </label>
            </div>

            <label className="text-sm">
              <div className="font-semibold">Temp HP</div>
              <input
                type="number"
                min={0}
                value={state.tempHP ?? 0}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    tempHP: normalizeInteger(Number(event.target.value)),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>

            <label className="text-sm">
              <div className="font-semibold">Hit Dice Total</div>
              <input
                type="number"
                min={0}
                value={state.hitDiceTotal ?? ""}
                onChange={(event) =>
                  setState((previous) => {
                    const raw = event.target.value.trim();
                    const nextHitDiceTotal = raw.length === 0 ? undefined : normalizeInteger(Number(raw));
                    const nextHitDiceSpent =
                      typeof nextHitDiceTotal === "number"
                        ? Math.min(normalizeInteger(previous.hitDiceSpent ?? 0), nextHitDiceTotal)
                        : normalizeInteger(previous.hitDiceSpent ?? 0);
                    return {
                      ...previous,
                      hitDiceTotal: nextHitDiceTotal,
                      hitDiceSpent: nextHitDiceSpent,
                    };
                  })
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                placeholder="Optional"
              />
            </label>

            <label className="text-sm">
              <div className="font-semibold">Hit Dice Spent</div>
              <input
                type="number"
                min={0}
                max={hitDiceTotalForConstraints ?? undefined}
                value={state.hitDiceSpent ?? 0}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    hitDiceSpent:
                      hitDiceTotalForConstraints === null
                        ? normalizeInteger(Number(event.target.value))
                        : normalizeInteger(Number(event.target.value), 0, hitDiceTotalForConstraints),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>

            <label className="text-sm">
              <div className="font-semibold">Death Save Successes</div>
              <input
                type="number"
                min={0}
                max={3}
                value={state.deathSaveSuccesses ?? 0}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    deathSaveSuccesses: normalizeInteger(Number(event.target.value), 0, 3),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>

            <label className="text-sm">
              <div className="font-semibold">Death Save Failures</div>
              <input
                type="number"
                min={0}
                max={3}
                value={state.deathSaveFailures ?? 0}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    deathSaveFailures: normalizeInteger(Number(event.target.value), 0, 3),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>

            <label className="text-sm">
              <div className="font-semibold">Exhaustion Level</div>
              <input
                type="number"
                min={0}
                max={10}
                value={state.exhaustionLevel ?? 0}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    exhaustionLevel: normalizeInteger(Number(event.target.value), 0, 10),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
          </div>
        </div>

        <div className="text-sm md:col-span-3">
          <div className="font-semibold">Coins</div>
          <div className="mt-1 grid grid-cols-5 gap-2">
            {COIN_DENOMINATIONS.map((denomination) => (
              <label key={`coins-${denomination}`} className="text-sm">
                <div className="font-semibold uppercase">{denomination}</div>
                <input
                  type="number"
                  min={0}
                  value={state.coins?.[denomination] ?? 0}
                  onChange={(event) => updateCoin(denomination, Number(event.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="text-sm md:col-span-3">
          <label className="text-sm">
            <div className="font-semibold">Other Wealth</div>
            <input
              type="text"
              value={state.otherWealth ?? ""}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  otherWealth: event.target.value,
                }))
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              placeholder="Trade goods, gems, favors, caravans..."
            />
          </label>
        </div>

        <div className="text-sm md:col-span-3">
          <div className="font-semibold">Attunement</div>
          <p className="mt-1 text-xs text-slate-300">
            Optional item slots. Empty entries are ignored in exports.
          </p>
          <div className="mt-2 grid gap-2">
            {attunementSlots.map((item, index) => (
              <div
                key={`attuned-slot-${index}`}
                className="grid gap-2 rounded border border-slate-700 bg-slate-950/30 p-2 md:grid-cols-3"
              >
                <label className="text-xs">
                  <div className="font-semibold">Slot {index + 1} Item</div>
                  <input
                    type="text"
                    value={item.name ?? ""}
                    onChange={(event) => updateAttunedItem(index, "name", event.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    placeholder="Item name"
                  />
                </label>
                <label className="text-xs">
                  <div className="font-semibold">Slot {index + 1} Item ID</div>
                  <input
                    type="text"
                    value={item.itemId ?? ""}
                    onChange={(event) => updateAttunedItem(index, "itemId", event.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    placeholder="Optional content id"
                  />
                </label>
                <label className="text-xs">
                  <div className="font-semibold">Slot {index + 1} Notes</div>
                  <input
                    type="text"
                    value={item.notes ?? ""}
                    onChange={(event) => updateAttunedItem(index, "notes", event.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    placeholder="Optional"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm md:col-span-3">
          <div className="font-semibold">Narrative</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <div className="font-semibold">Alignment</div>
              <input
                type="text"
                value={state.alignment ?? ""}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    alignment: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                placeholder="e.g. Neutral Good"
              />
            </label>
            <label className="text-sm">
              <div className="font-semibold">Appearance</div>
              <textarea
                value={state.appearance ?? ""}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    appearance: event.target.value,
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              <div className="font-semibold">Physical Description</div>
              <textarea
                value={state.physicalDescription ?? ""}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    physicalDescription: event.target.value,
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="font-semibold">Backstory</div>
              <textarea
                value={state.backstory ?? ""}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    backstory: event.target.value,
                  }))
                }
                rows={4}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="font-semibold">Notes</div>
              <textarea
                value={state.notes ?? ""}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
          </div>
        </div>

        <div className="text-sm md:col-span-3">
          <div className="font-semibold">Conditions</div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.conditions?.encumbered === true}
              onChange={(event) => updateEncumberedCondition(event.target.checked)}
            />
            <span>Encumbered (-10 ft speed)</span>
          </label>
        </div>

        {options.adventuringGear.length > 0 ? (
          <div className="text-sm md:col-span-3">
            <div className="font-semibold">Adventuring Gear</div>
            <p className="mt-1 text-xs text-slate-300">
              Add inventory entries and quantities for non-equipped gear.
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {options.adventuringGear.map((entry) => {
                const selectedEntry = (state.inventoryEntries ?? []).find(
                  (inventoryEntry) => inventoryEntry.itemId === entry.id,
                );
                const checked = Boolean(selectedEntry);
                const quantity = selectedEntry?.quantity ?? 1;

                return (
                  <div
                    key={`adventuring-gear-${entry.id}`}
                    className="rounded border border-slate-700 bg-slate-950/40 px-3 py-2"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          onToggleAdventuringGear(entry.id, event.target.checked)
                        }
                      />
                      <span>{entry.name}</span>
                    </label>
                    {checked ? (
                      <label className="mt-2 block text-xs text-slate-300">
                        Qty
                        <input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(event) =>
                            onSetAdventuringGearQuantity(entry.id, Number(event.target.value))
                          }
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                        />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {startingEquipment ? (
          <div className="text-sm md:col-span-3">
            <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
              <div className="font-semibold">Starting Equipment Package</div>
              <p className="mt-1 text-xs text-slate-300">
                Derived from selected class/background.
              </p>
              <div className="mt-2 text-xs text-slate-300">
                Items:{" "}
                {startingEquipment.itemIds.length > 0
                  ? startingEquipment.itemIds
                      .map((itemId) => content.equipmentById[itemId]?.name ?? itemId)
                      .join(", ")
                  : "(none)"}
              </div>
              <div className="mt-1 text-xs text-slate-300">
                Equipped suggestions:{" "}
                {[
                  startingEquipment.equippedArmorId
                    ? `Armor ${content.equipmentById[startingEquipment.equippedArmorId]?.name ?? startingEquipment.equippedArmorId}`
                    : null,
                  startingEquipment.equippedShieldId
                    ? `Shield ${content.equipmentById[startingEquipment.equippedShieldId]?.name ?? startingEquipment.equippedShieldId}`
                    : null,
                  startingEquipment.equippedWeaponId
                    ? `Weapon ${content.equipmentById[startingEquipment.equippedWeaponId]?.name ?? startingEquipment.equippedWeaponId}`
                    : null,
                ]
                  .filter((entry): entry is string => Boolean(entry))
                  .join(", ") || "(none)"}
              </div>
              <button
                type="button"
                onClick={onApplyStartingEquipment}
                disabled={!hasStartingEquipmentSuggestions}
                className="mt-3 rounded border border-slate-600 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Apply Starting Equipment
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {selectedBackgroundFixedOriginFeat || selectedBackgroundOriginChoice ? (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Origin Feat</h2>
          {selectedBackgroundFixedOriginFeat ? (
            <p className="mt-1 text-sm text-slate-200">
              Granted Origin Feat: <span className="font-semibold">{selectedBackgroundFixedOriginFeat.name}</span>
            </p>
          ) : null}

          {selectedBackgroundOriginChoice ? (
            <div className="mt-2 space-y-2">
              <label className="text-sm">
                <div className="font-semibold">Choose an Origin Feat</div>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  value={state.featSelections?.origin ?? state.originFeatId ?? ""}
                  onChange={(event) =>
                    setState((previous) => ({
                      ...previous,
                      originFeatId: event.target.value || undefined,
                      featSelections: {
                        ...(previous.featSelections ?? {}),
                        origin: event.target.value || undefined,
                      },
                    }))
                  }
                >
                  <option value="">Select origin feat…</option>
                  {selectableOriginFeats.map((feat) => (
                    <option key={`origin-feat-${feat.id}`} value={feat.id}>
                      {feat.name}
                    </option>
                  ))}
                </select>
              </label>
              {state.featSelections?.origin ?? state.originFeatId ? null : (
                <p className="text-sm font-semibold text-amber-300">
                  Choose 1 origin feat to complete character.
                </p>
              )}
              {selectableOriginFeats.length === 0 ? (
                <p className="text-sm text-amber-300">
                  No eligible origin feats available in enabled sources.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedClassSkillChoices ? (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Class Skills</h2>
        <p className="mt-1 text-sm text-slate-300">
          Choose {selectedClassSkillChoices.count} skills from class list (
          {chosenClassSkills.length}/{selectedClassSkillChoices.count} selected)
        </p>
        {chosenClassSkills.length < selectedClassSkillChoices.count ? (
          <p className="mt-2 text-sm font-semibold text-amber-300">
            Choose {selectedClassSkillChoices.count} class skills to complete character.
          </p>
        ) : null}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
            {selectedClassSkillChoices.from.map((skillId) => {
              const checked = chosenClassSkills.includes(skillId);
              const canChooseMore = chosenClassSkills.length < selectedClassSkillChoices.count;
              const disabled = !checked && !canChooseMore;

              return (
                <label key={`class-skill-${skillId}`} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => onToggleClassSkill(skillId, event.target.checked)}
                  />
                  <span>{skillNameById[skillId] ?? formatSkillId(skillId)}</span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedBackground?.abilityOptions ? (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Background Ability Increases</h2>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={backgroundMode === "2+1"}
                onChange={() => setBackgroundMode("2+1")}
              />
              One +2 and one +1
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={backgroundMode === "1+1+1"}
                onChange={() => setBackgroundMode("1+1+1")}
              />
              +1 / +1 / +1
            </label>
          </div>

          {backgroundMode === "2+1" ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="font-semibold">+2 Ability</div>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  value={backgroundPlusTwo}
                  onChange={(event) => setBackgroundPlusTwo(event.target.value as Ability)}
                >
                  {selectedBackground.abilityOptions.abilities.map((ability) => (
                    <option key={`plus2-${ability}`} value={ability}>
                      {ability.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <div className="font-semibold">+1 Ability</div>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  value={backgroundPlusOne}
                  onChange={(event) => setBackgroundPlusOne(event.target.value as Ability)}
                >
                  {selectedBackground.abilityOptions.abilities.map((ability) => (
                    <option key={`plus1-${ability}`} value={ability}>
                      {ability.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Level Advancements</h2>
        {missingAdvancementSlotLevels.length > 0 ? (
          <p className="mt-2 text-xs text-amber-300">
            Required advancement selections missing for level
            {missingAdvancementSlotLevels.length === 1 ? "" : "s"}:{" "}
            {missingAdvancementSlotLevels.join(", ")}.
          </p>
        ) : null}
        <div className="mt-3 space-y-3">
          {advancementSlots.length === 0 ? (
            <p className="text-sm text-slate-300">No feat/ASI slots at current level.</p>
          ) : (
            advancementSlots.map((slot) => {
              const level = Number(slot.level ?? 0);
              const filled = Boolean(slot.filled);
              const existingLevelFeat = (state.featSelections?.level ?? {})[level];
              const existing = existingLevelFeat
                ? {
                    type: "feat" as const,
                    featId: existingLevelFeat,
                    source: "level" as const,
                    level,
                  }
                : (state.advancements ?? []).find(
                    (entry) => entry.source === "level" && entry.level === level,
                  );
              const existingFeatId = existing?.type === "feat" ? existing.featId : undefined;
              const mode =
                slotModes[level] ??
                (existing?.type === "asi" ? "asi" : "feat");
              const levelEligibleFeats = levelEligibleFeatsBySlot[level] ?? [];
              const featDraft = featDrafts[level] ?? existingFeatId ?? levelEligibleFeats[0]?.id ?? "";
              const existingAsiDraft: AbilityChanges =
                existing?.type === "asi" ? (existing.changes as AbilityChanges) : {};
              const asiDraft = asiDrafts[level] ?? existingAsiDraft;
              const asiTotal = ABILITIES.reduce(
                (sum, ability) => sum + (asiDraft[ability] ?? 0),
                0,
              );

              return (
                <div key={`slot-${level}`} className="rounded border border-slate-700 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Level {level}</div>
                    {filled ? (
                      <button
                        type="button"
                        onClick={() => clearAdvancement(level)}
                        className="rounded border border-slate-700 px-2 py-1 text-xs"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <p
                    className={`mt-2 text-xs ${
                      filled ? "text-emerald-300" : "text-amber-300"
                    }`}
                  >
                    {filled ? "Selection applied for this slot." : "Required selection missing for this slot."}
                  </p>

                  <div className="mt-3 space-y-3">
                    <div className="flex gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={mode === "feat"}
                          onChange={() =>
                            setSlotModes((previous) => ({ ...previous, [level]: "feat" }))
                          }
                        />
                        Choose a Feat
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={mode === "asi"}
                          onChange={() =>
                            setSlotModes((previous) => ({ ...previous, [level]: "asi" }))
                          }
                        />
                        Ability Score Increase (ASI)
                      </label>
                    </div>

                    {mode === "feat" ? (
                      <div className="space-y-2">
                        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                          <select
                            value={featDraft}
                            onChange={(event) =>
                              setFeatDrafts((previous) => ({
                                ...previous,
                                [level]: event.target.value,
                              }))
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                            disabled={levelEligibleFeats.length === 0}
                          >
                            {levelEligibleFeats.length === 0 ? (
                              <option value="">No eligible feats</option>
                            ) : null}
                            {levelEligibleFeats.map((feat) => (
                              <option key={`slot-${level}-feat-${feat.id}`} value={feat.id}>
                                {labelFeat(feat)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setLevelFeatSelection(level, featDraft)}
                            className="rounded border border-slate-700 px-3 py-1 text-sm"
                            disabled={featDraft.length === 0 || levelEligibleFeats.length === 0}
                          >
                            Apply
                          </button>
                        </div>
                        {levelEligibleFeats.length === 0 ? (
                          <p className="text-xs text-amber-300">
                            No feats currently meet prerequisites or duplicate restrictions.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                          {ABILITIES.map((ability) => (
                            <label key={`asi-${level}-${ability}`} className="text-xs">
                              <div className="font-semibold uppercase">{ability}</div>
                              <input
                                type="number"
                                min={0}
                                max={2}
                                value={asiDraft[ability] ?? 0}
                                onChange={(event) =>
                                  setAsiDrafts((previous) => ({
                                    ...previous,
                                    [level]: {
                                      ...(previous[level] ?? existingAsiDraft),
                                      [ability]: Math.max(
                                        0,
                                        Math.min(2, Number(event.target.value) || 0),
                                      ),
                                    },
                                  }))
                                }
                                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={asiTotal === 2 ? "text-emerald-300" : "text-amber-300"}
                          >
                            ASI points used: {asiTotal}/2
                          </span>
                          <button
                            type="button"
                            onClick={() => upsertAsiAdvancement(level, asiDraft)}
                            className="rounded border border-slate-700 px-3 py-1 text-sm"
                            disabled={asiTotal !== 2}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {selectedClass?.spellcasting ? (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Spell Selection</h2>
          <p className="mt-1 text-sm text-slate-300">
            Available spells come from the selected class spell list references (
            {classSpellListRefIds.length} list{classSpellListRefIds.length === 1 ? "" : "s"}).
          </p>
          {missingClassSpellListRefIds.length > 0 ? (
            <p className="mt-2 text-sm text-amber-300">
              Missing spell lists in content: {missingClassSpellListRefIds.join(", ")}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {spellSelectionBuckets.map((bucket) => {
              const selectedSet = new Set(bucket.selectedIds);
              const atLimit =
                typeof bucket.maxCount === "number" && bucket.selectedIds.length >= bucket.maxCount;
              const overLimit =
                typeof bucket.maxCount === "number" && bucket.selectedIds.length > bucket.maxCount;
              return (
                <div key={`spell-selection-${bucket.field}`} className="rounded border border-slate-700 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{bucket.label}</div>
                    <div className="text-xs text-slate-300">
                      {bucket.selectedIds.length}/
                      {typeof bucket.maxCount === "number" ? bucket.maxCount : "∞"}
                    </div>
                  </div>
                  {overLimit ? (
                    <p className="mt-1 text-xs text-rose-300">
                      Over limit by {bucket.selectedIds.length - bucket.maxCount!}. Remove spells to resolve.
                    </p>
                  ) : null}

                  <div className="mt-2 space-y-1">
                    {bucket.selectedIds.length === 0 ? (
                      <div className="text-xs text-slate-400">(none selected)</div>
                    ) : (
                      bucket.selectedIds.map((spellId) => {
                        const spell = content.spellsById[spellId];
                        return (
                          <div
                            key={`selected-${bucket.field}-${spellId}`}
                            className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-xs"
                          >
                            <span className="truncate">
                              {spell
                                ? `${formatSpellNameWithFlags(spell)} (L${spell.level})`
                                : `${spellId} (missing)`}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onToggleSpellSelection(bucket.field, spellId, false, bucket.maxCount)
                              }
                              className="rounded border border-slate-700 px-2 py-0.5"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-3 max-h-56 overflow-auto rounded border border-slate-800 bg-slate-950/70 p-2">
                    {bucket.availableSpells.length === 0 ? (
                      <div className="text-xs text-slate-400">No available spells in this category.</div>
                    ) : (
                      <div className="space-y-1">
                        {bucket.availableSpells.map((spell) => {
                          const checked = selectedSet.has(spell.id);
                          const disabled = !checked && atLimit;
                          return (
                            <label
                              key={`spell-option-${bucket.field}-${spell.id}`}
                              className="flex items-start gap-2 rounded px-1 py-1 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(event) =>
                                  onToggleSpellSelection(
                                    bucket.field,
                                    spell.id,
                                    event.target.checked,
                                    bucket.maxCount,
                                  )
                                }
                              />
                              <span className="leading-5">
                                {formatSpellNameWithFlags(spell)}
                                <span className="ml-1 text-slate-400">(L{spell.level})</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Derived State</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded border border-slate-700 p-3">
            <div className="font-semibold">Proficiency Bonus</div>
            <div className="mt-1 text-lg">{String(derived.proficiencyBonus ?? "-")}</div>
          </div>
          <div className="rounded border border-slate-700 p-3">
            <div className="font-semibold">Max HP</div>
            <div className="mt-1 text-lg">{String(derived.maxHP ?? "-")}</div>
          </div>
          <div className="rounded border border-slate-700 p-3">
            <div className="font-semibold">Armor Class</div>
            <div className="mt-1 text-lg">{String(derived.armorClass ?? "-")}</div>
          </div>
          <div className="rounded border border-slate-700 p-3">
            <div className="font-semibold">Attack Proficiency</div>
            <div className="mt-1 text-lg">
              {derived.attack
                ? derived.warnings.some((warning) => warning.includes("not proficient"))
                  ? "Not proficient"
                  : "Proficient"
                : "-"}
            </div>
            {derived.attack ? (
              <div className="mt-1 text-xs text-slate-300">
                {selectedWeapon?.name ?? derived.attack.name}: {derived.attack.toHit >= 0 ? "+" : ""}
                {derived.attack.toHit} to hit
              </div>
            ) : null}
          </div>
        </div>

        {spellcastingAbility ? (
          <div className="mt-4 rounded border border-slate-700 p-3">
            <h3 className="text-sm font-semibold">Spellcasting</h3>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs text-slate-300">Ability</div>
                <div className="font-semibold uppercase">{spellcastingAbility}</div>
              </div>
              <div>
                <div className="text-xs text-slate-300">Ability Mod</div>
                <div className="font-semibold">
                  {spellcastingAbility && derived.abilityMods[spellcastingAbility] >= 0 ? "+" : ""}
                  {spellcastingAbility ? derived.abilityMods[spellcastingAbility] : ""}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-300">Save DC</div>
                <div className="font-semibold">{spellSaveDC ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-300">Attack Bonus</div>
                <div className="font-semibold">
                  {spellAttackBonus !== null && spellAttackBonus >= 0 ? "+" : ""}
                  {spellAttackBonus ?? "-"}
                </div>
              </div>
            </div>
            <div className="mt-3 overflow-auto">
              <table className="w-full min-w-[320px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="py-1 pr-3">Slot Level</th>
                    <th className="py-1">Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 9 }, (_, index) => index + 1).map((slotLevel) => (
                    <tr key={`builder-spell-slot-${slotLevel}`} className="border-b border-slate-800">
                      <td className="py-1 pr-3">{slotLevel}</td>
                      <td className="py-1">{spellSlots?.[slotLevel - 1] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <div>
                <div className="text-slate-300">Cantrips Known</div>
                <div>{derived.spellcasting?.cantripsKnownIds.join(", ") || "(none)"}</div>
              </div>
              <div>
                <div className="text-slate-300">Known Spells</div>
                <div>{derived.spellcasting?.knownSpellIds.join(", ") || "(none)"}</div>
              </div>
              <div>
                <div className="text-slate-300">Prepared Spells</div>
                <div>{derived.spellcasting?.preparedSpellIds.join(", ") || "(none)"}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold">Final Abilities</div>
            <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
              {JSON.stringify(derived.finalAbilities, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-sm font-semibold">Feats</div>
            <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
              {JSON.stringify(derived.feats, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-sm font-semibold">Saves</div>
            <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
              {JSON.stringify(derived.savingThrows, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-sm font-semibold">Skills & Tools</div>
            <div className="mt-1 max-h-56 overflow-auto rounded bg-slate-950 p-3">
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {skillAndToolRows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-800 align-top">
                      <td className="py-1 pr-2">
                        <span className="mr-2 text-[10px] uppercase text-slate-400">{row.kind}</span>
                        {row.label}
                      </td>
                      <td className="py-1 text-right font-semibold">
                        {row.kind === "skill" ? formatSigned(row.value) : "Proficient"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {process.env.NODE_ENV !== "production" ? (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <button
            type="button"
            onClick={() => setShowDebug((value) => !value)}
            className="text-sm font-semibold"
          >
            Debug {showDebug ? "▲" : "▼"}
          </button>

          {showDebug ? (
            <div className="mt-4 grid gap-4">
              <div>
                <div className="text-xs font-semibold">CharacterState</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(state, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-xs font-semibold">DerivedState.advancementSlots</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(derived.advancementSlots, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-xs font-semibold">DerivedState.finalAbilities</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(derived.finalAbilities, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-xs font-semibold">DerivedState.feats</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(derived.feats, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-xs font-semibold">Merge Report</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(mergeReport, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
