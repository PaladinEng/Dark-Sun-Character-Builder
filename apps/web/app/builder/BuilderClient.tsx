"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { MergedContent } from "@dark-sun/content";
import type { CharacterState, DerivedState, ValidationReport } from "@dark-sun/rules";
import {
  computeDerivedState,
  getAvailableAdvancementSlots,
  validateCharacter,
} from "@dark-sun/rules";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
type AbilityChanges = Partial<Record<Ability, number>>;

type BackgroundAbilityOptions = {
  abilities: Ability[];
  mode: "2+1_or_1+1+1";
};

type Option = {
  id: string;
  name: string;
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
};

type BuilderOptions = {
  species: Option[];
  backgrounds: Option[];
  classes: Option[];
  armor: Option[];
  shields: Option[];
  weapons: Option[];
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
  abilities: Record<Ability, number>;
  abilityModifiers: Record<Ability, number>;
  proficiencyBonus: number;
  passivePerception: number;
  skills: Record<string, number>;
  savingThrows: Record<Ability, number>;
  AC: number;
  HP: number;
  speed: number;
  attacks: Array<{ name: string; toHit: number; damage: string }>;
  feats: { id: string; name: string }[];
  background: string | null;
  class: string | null;
  species: string | null;
  toolProficiencies: string[];
  languages: string[];
  spellcastingAbility: Ability | null;
  spellSaveDC: number | null;
  spellAttackBonus: number | null;
  spellSlots: Record<number, number> | null;
  spellcasting?: {
    ability: Ability;
    abilityMod: number;
    saveDC: number;
    attackBonus: number;
    progression: "full" | "half" | "third" | "pact";
    slots: Record<number, number>;
    knownSpellIds: string[];
    preparedSpellIds: string[];
    cantripsKnownIds: string[];
  };
  warnings: string[];
};

type PrintPayload = {
  characterState: CharacterState;
  enabledPackIds: string[];
  generatedAt: string;
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
const SOURCE_STORAGE_KEY = "darksun-builder:sources";

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

function labelSkill(skillId: string): string {
  return skillId
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
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

function downloadFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function encodePrintPayload(payload: PrintPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) {
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
    selectedSpeciesId: options.species[0]?.id,
    selectedBackgroundId: options.backgrounds[0]?.id,
    selectedClassId: options.classes[0]?.id,
    equippedArmorId: options.armor[0]?.id,
    equippedShieldId: options.shields[0]?.id,
    equippedWeaponId: options.weapons[0]?.id,
    chosenSkillProficiencies: [],
    chosenClassSkills: [],
    chosenSaveProficiencies: [],
    toolProficiencies: [],
    knownSpellIds: [],
    preparedSpellIds: [],
    cantripsKnownIds: [],
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

    const params = new URLSearchParams(searchParams.toString());
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
  const selectedWeapon = useMemo(
    () => options.weapons.find((entry) => entry.id === state.equippedWeaponId),
    [options.weapons, state.equippedWeaponId],
  );
  const selectedClassSkillChoices = selectedClass?.classSkillChoices;
  const chosenClassSkills = state.chosenClassSkills ?? [];
  const originFeats = useMemo(
    () => collectArray(content, "feats").filter((feat) => feat.category === "origin"),
    [content],
  );
  const selectedBackgroundOriginChoice = selectedBackground?.originFeatChoice;
  const selectedBackgroundFixedOriginFeatId =
    selectedBackground?.grantsOriginFeatId ?? selectedBackground?.grantsFeat;
  const selectedBackgroundFixedOriginFeat = selectedBackgroundFixedOriginFeatId
    ? originFeats.find((feat) => feat.id === selectedBackgroundFixedOriginFeatId)
    : undefined;
  const selectableOriginFeats = useMemo(() => {
    if (!selectedBackgroundOriginChoice) {
      return [];
    }
    const allowedIds = selectedBackgroundOriginChoice.featIds;
    if (!allowedIds || allowedIds.length === 0) {
      return originFeats;
    }
    const allowedSet = new Set(allowedIds);
    return originFeats.filter((feat) => allowedSet.has(feat.id));
  }, [originFeats, selectedBackgroundOriginChoice]);

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
        return list[0]?.id;
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

  const derived = useMemo(
    () => computeDerivedState(state, content) as DerivedState,
    [content, state],
  );
  const validation = useMemo<ValidationReport>(
    () => validateCharacter(state, content),
    [content, state],
  );

  const feats = useMemo(() => {
    return collectArray(content, "feats").sort((a, b) => a.name.localeCompare(b.name));
  }, [content]);
  const levelEligibleFeats = useMemo(() => {
    const levelSlotFeatIds = Object.values(state.featSelections?.level ?? {}).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    const chosenOriginFeatId = state.featSelections?.origin ?? state.originFeatId;
    const selectedIds = new Set<string>([
      ...(state.selectedFeats ?? []),
      ...levelSlotFeatIds,
      ...((state.advancements ?? [])
        .filter((entry): entry is Extract<NonNullable<BuilderState["advancements"]>[number], { type: "feat" }> =>
          entry.type === "feat")
        .map((entry) => entry.featId)),
      ...(selectedBackgroundFixedOriginFeatId ? [selectedBackgroundFixedOriginFeatId] : []),
      ...(selectedBackgroundOriginChoice && chosenOriginFeatId ? [chosenOriginFeatId] : []),
    ]);

    return feats.filter(
      (feat) =>
        feat.category !== "origin" &&
        isFeatEligibleForState(feat, state, derived, selectedIds),
    );
  }, [
    derived,
    feats,
    selectedBackgroundFixedOriginFeatId,
    selectedBackgroundOriginChoice,
    state,
  ]);

  const exportedDerivedState = useMemo<ExportedDerivedState>(
    () => ({
      level: Math.max(1, Math.floor(state.level || 1)),
      abilities: derived.finalAbilities,
      abilityModifiers: derived.abilityMods,
      proficiencyBonus: derived.proficiencyBonus,
      passivePerception: derived.passivePerception,
      skills: derived.skills,
      savingThrows: derived.savingThrows,
      AC: derived.armorClass,
      HP: derived.maxHP,
      speed: derived.speed,
      attacks: derived.attack ? [derived.attack] : [],
      feats: derived.feats,
      background: selectedBackground?.name ?? null,
      class: selectedClass?.name ?? null,
      species: selectedSpecies?.name ?? null,
      toolProficiencies: derived.toolProficiencies,
      languages: derived.languages,
      spellcastingAbility: derived.spellcastingAbility,
      spellSaveDC: derived.spellSaveDC,
      spellAttackBonus: derived.spellAttackBonus,
      spellSlots: derived.spellSlots,
      spellcasting: derived.spellcasting,
      warnings: derived.warnings,
    }),
    [derived, selectedBackground?.name, selectedClass?.name, selectedSpecies?.name, state.level],
  );

  const advancementSlots = (derived.advancementSlots ?? []) as Array<Record<string, unknown>>;
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus = derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;

  const applySources = (nextEnabledIds: string[]) => {
    const ordered = manifestOrder.filter((id) => nextEnabledIds.includes(id));
    setEnabledSources(ordered);
    window.localStorage.setItem(SOURCE_STORAGE_KEY, ordered.join(","));

    const params = new URLSearchParams(searchParams.toString());
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

  const onDownloadPdf = () => {
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

    const payload: PrintPayload = {
      characterState: state,
      enabledPackIds: enabledSources,
      generatedAt: new Date().toISOString(),
    };
    const encoded = encodePrintPayload(payload);
    const targetUrl = `/print?payload=${encodeURIComponent(encoded)}`;
    const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      router.push(targetUrl);
    }
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
          Download machine-readable data or open a print-ready sheet for PDF export.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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

        <div className="grid grid-cols-3 gap-2">
          {ABILITIES.map((ability) => (
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
          ))}
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
            {options.weapons.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
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
                  <span>{labelSkill(skillId)}</span>
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
              const mode =
                slotModes[level] ??
                (existing?.type === "asi" ? "asi" : "feat");
              const featDraft = featDrafts[level] ?? existingLevelFeat ?? levelEligibleFeats[0]?.id ?? "";
              const asiDraft = asiDrafts[level] ?? {};
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

                  {filled ? (
                    <pre className="mt-2 overflow-auto rounded bg-slate-950 p-2 text-xs">
                      {JSON.stringify(existing ?? slot, null, 2)}
                    </pre>
                  ) : (
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
                                        ...(previous[level] ?? {}),
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
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

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
                      <td className="py-1">{spellSlots?.[slotLevel] ?? 0}</td>
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
            <div className="text-sm font-semibold">Skills</div>
            <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
              {JSON.stringify(derived.skills, null, 2)}
            </pre>
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
