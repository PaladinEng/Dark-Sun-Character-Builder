"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { MergedContent } from "@dark-sun/content";
import type { CharacterState, DerivedState } from "@dark-sun/rules";
import { computeDerivedState } from "@dark-sun/rules";

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
  category?: "origin" | "general";
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
    chosenSaveProficiencies: [],
    toolProficiencies: [],
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

  const derived = useMemo(
    () => computeDerivedState(state, content) as DerivedState,
    [content, state],
  );

  const feats = useMemo(() => {
    return collectArray(content, "feats").sort((a, b) => a.name.localeCompare(b.name));
  }, [content]);

  const advancementSlots = (derived.advancementSlots ?? []) as Array<Record<string, unknown>>;

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

  const upsertAdvancement = (
    level: number,
    advancement:
      | { type: "feat"; featId: string; source: "level"; level: number }
      | { type: "asi"; changes: AbilityChanges; source: "level"; level: number },
  ) => {
    setState((previous) => {
      const existing = (previous.advancements ?? []).filter(
        (entry) => !(entry.source === "level" && entry.level === level),
      );
      return {
        ...previous,
        advancements: [...existing, advancement].sort((a, b) => a.level - b.level),
      };
    });
  };

  const clearAdvancement = (level: number) => {
    setState((previous) => ({
      ...previous,
      advancements: (previous.advancements ?? []).filter(
        (entry) => !(entry.source === "level" && entry.level === level),
      ),
    }));
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
              setState((previous) => ({ ...previous, selectedClassId: event.target.value || undefined }))
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
              const existing = (state.advancements ?? []).find(
                (entry) => entry.source === "level" && entry.level === level,
              );
              const mode = slotModes[level] ?? "feat";
              const featDraft = featDrafts[level] ?? feats[0]?.id ?? "";
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
                          >
                            {feats.map((feat) => (
                              <option key={`slot-${level}-feat-${feat.id}`} value={feat.id}>
                                {labelFeat(feat)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              upsertAdvancement(level, {
                                type: "feat",
                                featId: featDraft,
                                source: "level",
                                level,
                              })
                            }
                            className="rounded border border-slate-700 px-3 py-1 text-sm"
                            disabled={featDraft.length === 0}
                          >
                            Apply
                          </button>
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
                              onClick={() =>
                                upsertAdvancement(level, {
                                  type: "asi",
                                  changes: asiDraft,
                                  source: "level",
                                  level,
                                })
                              }
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
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
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
        </div>

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
