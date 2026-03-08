import { access } from "node:fs/promises";
import { join } from "node:path";

import Link from "next/link";
import { getSubclassFeatureIdsForLevel } from "@dark-sun/content";
import type { CharacterState } from "@dark-sun/rules";
import { computeDerivedState } from "@dark-sun/rules";

import { getMergedContent } from "../../src/lib/content";
import { formatSpellNameWithFlags } from "../../src/lib/spells";
import PrintSheetControls from "./PrintSheetControls";

export const runtime = "nodejs";

type PrintPayload = {
  characterState: CharacterState;
  enabledPackIds: string[];
  generatedAt?: string;
};

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const SKILL_ORDER = [
  "athletics",
  "acrobatics",
  "sleight_of_hand",
  "stealth",
  "arcana",
  "history",
  "investigation",
  "nature",
  "religion",
  "animal_handling",
  "insight",
  "medicine",
  "perception",
  "survival",
  "deception",
  "intimidation",
  "performance",
  "persuasion",
] as const;

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatSkillName(skill: string): string {
  return skill
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMasteryLabel(mastery: string): string {
  return mastery
    .split(/[_\s-]+/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConditionLabel(conditionId: string): string {
  return conditionId
    .split(/[_\s-]+/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAttackName(attack: { name: string; mastery?: string[] } | null): string {
  if (!attack) {
    return "";
  }
  const masteries = attack.mastery ?? [];
  if (masteries.length === 0) {
    return attack.name;
  }
  const masteryLabel = masteries.map((entry) => formatMasteryLabel(entry)).join(", ");
  return `${attack.name} (${masteryLabel})`;
}

function formatSenseSummary(sense: { type: string; range?: number }): string {
  const typeLabel = sense.type
    .split(/[_\s-]+/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  return typeof sense.range === "number" ? `${typeLabel} ${sense.range} ft.` : typeLabel;
}

function sortIds(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeOptionalNonNegativeInt(value: unknown, maximum?: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const bounded = Math.max(0, Math.floor(parsed));
  if (typeof maximum === "number") {
    return Math.min(maximum, bounded);
  }
  return bounded;
}

function normalizeWarlockMysticArcanumByLevel(
  value: unknown,
): Partial<Record<6 | 7 | 8 | 9, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Partial<Record<6 | 7 | 8 | 9, string>> = {};
  for (const [key, spellId] of Object.entries(value)) {
    const tier = Number(key);
    if ((tier !== 6 && tier !== 7 && tier !== 8 && tier !== 9) || typeof spellId !== "string") {
      continue;
    }
    if (spellId.length > 0) {
      out[tier] = spellId;
    }
  }
  return out;
}

function normalizeCharacterState(input: CharacterState): CharacterState {
  return {
    ...input,
    chosenSkillProficiencies: Array.isArray(input.chosenSkillProficiencies)
      ? input.chosenSkillProficiencies
      : [],
    chosenSaveProficiencies: Array.isArray(input.chosenSaveProficiencies)
      ? input.chosenSaveProficiencies
      : [],
    toolProficiencies: Array.isArray(input.toolProficiencies) ? input.toolProficiencies : [],
    languages: Array.isArray(input.languages) ? input.languages : [],
    knownSpellIds: Array.isArray(input.knownSpellIds) ? input.knownSpellIds : [],
    preparedSpellIds: Array.isArray(input.preparedSpellIds) ? input.preparedSpellIds : [],
    cantripsKnownIds: Array.isArray(input.cantripsKnownIds) ? input.cantripsKnownIds : [],
    selectedFeats: Array.isArray(input.selectedFeats) ? input.selectedFeats : [],
    selectedFeatureIds: Array.isArray(input.selectedFeatureIds) ? input.selectedFeatureIds : [],
    warlockInvocationFeatureIds: Array.isArray(input.warlockInvocationFeatureIds)
      ? input.warlockInvocationFeatureIds.filter((entry): entry is string => typeof entry === "string")
      : [],
    warlockPactBoonFeatureId: normalizeOptionalString(input.warlockPactBoonFeatureId),
    warlockMysticArcanumByLevel: normalizeWarlockMysticArcanumByLevel(
      input.warlockMysticArcanumByLevel,
    ),
    abilityIncreases: Array.isArray(input.abilityIncreases) ? input.abilityIncreases : [],
    advancements: Array.isArray(input.advancements) ? input.advancements : [],
    inventoryItemIds: Array.isArray(input.inventoryItemIds) ? input.inventoryItemIds : [],
    inventoryEntries: Array.isArray(input.inventoryEntries) ? input.inventoryEntries : [],
    subclass: normalizeOptionalString(input.subclass),
    xp: normalizeOptionalNonNegativeInt(input.xp),
    heroicInspiration: input.heroicInspiration === true,
    tempHP: normalizeOptionalNonNegativeInt(input.tempHP),
    hitDiceTotal: normalizeOptionalNonNegativeInt(input.hitDiceTotal),
    hitDiceSpent: normalizeOptionalNonNegativeInt(input.hitDiceSpent),
    deathSaveSuccesses: normalizeOptionalNonNegativeInt(input.deathSaveSuccesses, 3),
    deathSaveFailures: normalizeOptionalNonNegativeInt(input.deathSaveFailures, 3),
    exhaustionLevel: normalizeOptionalNonNegativeInt(input.exhaustionLevel, 10),
    coins: input.coins && typeof input.coins === "object" ? input.coins : undefined,
  };
}

function decodePayload(raw: string | string[] | undefined): PrintPayload | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<PrintPayload>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!parsed.characterState || typeof parsed.characterState !== "object") {
      return null;
    }

    return {
      characterState: normalizeCharacterState(parsed.characterState as CharacterState),
      enabledPackIds: Array.isArray(parsed.enabledPackIds)
        ? parsed.enabledPackIds.filter((id): id is string => typeof id === "string")
        : [],
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
    };
  } catch {
    return null;
  }
}

async function fileExists(relativePath: string): Promise<boolean> {
  const candidates = [
    join(process.cwd(), relativePath),
    join(process.cwd(), "apps", "web", relativePath),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
      // Try next candidate.
    }
  }

  return false;
}

export default async function PrintPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const payload = decodePayload(params.payload);

  if (!payload) {
    return (
      <main className="print-root">
        <section className="sheet-page error-page">
          <h1>Unable to load character sheet</h1>
          <p>Open the builder and use Download PDF to generate a print-ready sheet.</p>
          <Link href="/builder" className="back-link">
            Back to Builder
          </Link>
        </section>
      </main>
    );
  }

  const merged = await getMergedContent(payload.enabledPackIds);
  const derived = computeDerivedState(payload.characterState, merged.content);
  const showOverlayToggle = process.env.NODE_ENV !== "production";
  const hasOverlayPage1 = await fileExists("public/sheets/template-page1.png");
  const hasOverlayPage2 = await fileExists("public/sheets/template-page2.png");

  const species = payload.characterState.selectedSpeciesId
    ? merged.content.speciesById[payload.characterState.selectedSpeciesId]
    : undefined;
  const background = payload.characterState.selectedBackgroundId
    ? merged.content.backgroundsById[payload.characterState.selectedBackgroundId]
    : undefined;
  const klass = payload.characterState.selectedClassId
    ? merged.content.classesById[payload.characterState.selectedClassId]
    : undefined;
  const selectedSubclass = payload.characterState.subclass
    ? merged.content.subclassesById?.[payload.characterState.subclass]
    : undefined;
  const armor = payload.characterState.equippedArmorId
    ? merged.content.equipmentById[payload.characterState.equippedArmorId]
    : undefined;
  const shield = payload.characterState.equippedShieldId
    ? merged.content.equipmentById[payload.characterState.equippedShieldId]
    : undefined;
  const weapon = payload.characterState.equippedWeaponId
    ? merged.content.equipmentById[payload.characterState.equippedWeaponId]
    : undefined;
  const coinValues = payload.characterState.coins ?? {};
  const gpCoins = Number.isFinite(coinValues.gp)
    ? Math.max(0, Math.floor(coinValues.gp ?? 0))
    : 0;
  const spCoins = Number.isFinite(coinValues.sp)
    ? Math.max(0, Math.floor(coinValues.sp ?? 0))
    : 0;
  const cpCoins = Number.isFinite(coinValues.cp)
    ? Math.max(0, Math.floor(coinValues.cp ?? 0))
    : 0;
  const inventoryQuantities = new Map<string, number>();
  for (const itemId of payload.characterState.inventoryItemIds ?? []) {
    if (!inventoryQuantities.has(itemId)) {
      inventoryQuantities.set(itemId, 1);
    }
  }
  for (const entry of payload.characterState.inventoryEntries ?? []) {
    const normalizedQuantity =
      typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? Math.max(1, Math.floor(entry.quantity))
        : 1;
    inventoryQuantities.set(
      entry.itemId,
      Math.max(inventoryQuantities.get(entry.itemId) ?? 0, normalizedQuantity),
    );
  }

  const inventoryNameList = [...inventoryQuantities.entries()]
    .map(([itemId, quantity]) => {
      const label = merged.content.equipmentById[itemId]?.name ?? itemId;
      return quantity > 1 ? `${label} x${quantity}` : label;
    })
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 6);

  const toolProficiencies = sortIds(derived.toolProficiencies);
  const languages = sortIds(derived.languages);
  const level = Math.max(1, Math.floor(payload.characterState.level || 1));
  const xp = Number.isFinite(payload.characterState.xp)
    ? Math.max(0, Math.floor(payload.characterState.xp ?? 0))
    : 0;
  const tempHP = Number.isFinite(payload.characterState.tempHP)
    ? Math.max(0, Math.floor(payload.characterState.tempHP ?? 0))
    : 0;
  const hitDiceTotal = Number.isFinite(payload.characterState.hitDiceTotal)
    ? Math.max(0, Math.floor(payload.characterState.hitDiceTotal ?? 0))
    : null;
  const hitDiceSpent = Number.isFinite(payload.characterState.hitDiceSpent)
    ? Math.max(0, Math.floor(payload.characterState.hitDiceSpent ?? 0))
    : 0;
  const deathSaveSuccesses = Number.isFinite(payload.characterState.deathSaveSuccesses)
    ? Math.max(0, Math.min(3, Math.floor(payload.characterState.deathSaveSuccesses ?? 0)))
    : 0;
  const deathSaveFailures = Number.isFinite(payload.characterState.deathSaveFailures)
    ? Math.max(0, Math.min(3, Math.floor(payload.characterState.deathSaveFailures ?? 0)))
    : 0;
  const exhaustionLevel = Number.isFinite(payload.characterState.exhaustionLevel)
    ? Math.max(0, Math.min(10, Math.floor(payload.characterState.exhaustionLevel ?? 0)))
    : 0;

  const featureNames = [...new Set([
    ...(payload.characterState.selectedFeatureIds ?? []),
    ...(payload.characterState.warlockInvocationFeatureIds ?? []),
    ...(payload.characterState.warlockPactBoonFeatureId
      ? [payload.characterState.warlockPactBoonFeatureId]
      : []),
  ])]
    .map((id) => merged.content.featuresById[id]?.name)
    .filter((name): name is string => Boolean(name));
  const classFeatureIds = new Set<string>();
  const classFeatureNames = (klass?.classFeaturesByLevel ?? [])
    .filter((entry) => entry.level <= level)
    .sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      return a.featureId.localeCompare(b.featureId);
    })
    .filter((entry) => {
      if (classFeatureIds.has(entry.featureId)) {
        return false;
      }
      classFeatureIds.add(entry.featureId);
      return true;
    })
    .map((entry) => merged.content.featuresById[entry.featureId]?.name ?? entry.featureId);
  const subclassFeatureNames =
    selectedSubclass && klass && selectedSubclass.classId === klass.id
      ? getSubclassFeatureIdsForLevel(selectedSubclass, level).map(
          (featureId) => merged.content.featuresById[featureId]?.name ?? featureId,
        )
      : [];

  const sensesSummary =
    derived.senses.length > 0
      ? `Senses: ${derived.senses.map((sense) => formatSenseSummary(sense)).join(", ")}`
      : null;
  const resistancesSummary =
    derived.resistances.length > 0
      ? `Resistances: ${derived.resistances.join(", ")}`
      : null;
  const passiveTraits = derived.traits;
  const activeConditionEntries = (derived.activeConditionIds ?? []).map(
    (conditionId) => `Condition: ${formatConditionLabel(conditionId)}`,
  );
  const activeModifierEntries = (derived.appliedModifiers ?? []).map((modifier) => {
    const effectSummary = modifier.effects
      .map((effect) => {
        if (effect.type === "add_speed") {
          const sign = effect.value >= 0 ? "+" : "";
          return `${sign}${effect.value} ft speed`;
        }
        return effect.type;
      })
      .join(", ");
    return effectSummary.length > 0
      ? `Modifier: ${modifier.label} (${effectSummary})`
      : `Modifier: ${modifier.label}`;
  });

  const traitEntries = [
    sensesSummary,
    resistancesSummary,
    ...activeConditionEntries,
    ...activeModifierEntries,
    ...passiveTraits.map((entry) => `Trait: ${entry}`),
    species ? `Species: ${species.name}` : null,
    background ? `Background: ${background.name}` : null,
    klass ? `Class: ${klass.name}` : null,
    selectedSubclass ? `Subclass: ${selectedSubclass.name}` : null,
    ...classFeatureNames.map((name) => `Class Feature: ${name}`),
    ...subclassFeatureNames.map((name) => `Subclass Feature: ${name}`),
    ...featureNames.map((name) => `Feature: ${name}`),
    ...derived.feats.map((feat) => `Feat: ${feat.name}`),
  ].filter((entry): entry is string => Boolean(entry));

  const skillProficiencySet = new Set(derived.skillProficiencies ?? []);
  const saveProficiencySet = new Set(derived.saveProficiencies ?? []);

  const attacks = derived.attack ? [derived.attack] : [];
  const attackRows = [...attacks, ...Array.from({ length: Math.max(0, 4 - attacks.length) }, () => null)];

  const attributions = merged.packs
    .map((pack) => pack.manifest.attributionText?.trim())
    .filter((text): text is string => Boolean(text));

  const passivePerception = derived.passivePerception;
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus =
    derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellcastingProgression = derived.spellcasting?.progression ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;
  const knownSpellIds = derived.spellcasting?.knownSpellIds ?? sortIds(payload.characterState.knownSpellIds);
  const preparedSpellIds =
    derived.spellcasting?.preparedSpellIds ?? sortIds(payload.characterState.preparedSpellIds);
  const cantripIds =
    derived.spellcasting?.cantripsKnownIds ?? sortIds(payload.characterState.cantripsKnownIds);
  const knownSpellNames = knownSpellIds.map((id) => {
    const spell = merged.content.spellsById[id];
    return spell ? formatSpellNameWithFlags(spell) : id;
  });
  const preparedSpellNames = preparedSpellIds.map((id) => {
    const spell = merged.content.spellsById[id];
    return spell ? formatSpellNameWithFlags(spell) : id;
  });
  const cantripNames = cantripIds.map((id) => {
    const spell = merged.content.spellsById[id];
    return spell ? formatSpellNameWithFlags(spell) : id;
  });
  const spellSlotLevels = Array.from({ length: 9 }, (_value, index) => index + 1);

  return (
    <main className="print-root">
      <PrintSheetControls
        showOverlayToggle={showOverlayToggle && (hasOverlayPage1 || hasOverlayPage2)}
      />

      <section
        className={[
          "sheet-page",
          "page-1",
          hasOverlayPage1 ? "has-overlay" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="sheet-content">
          <div className="page1-layout">
            <header className="page-header">
              <div className="panel name-panel">
                <div className="panel-title">Character Name</div>
                <div className="character-name-line">______________________________</div>
              </div>
              <div className="panel identity-panel">
                <div className="identity-grid">
                  <div>
                    <div className="small-label">Class</div>
                    <div className="small-value">{klass?.name ?? "Unspecified"}</div>
                  </div>
                  <div>
                  <div className="small-label">Subclass</div>
                    <div className="small-value">{selectedSubclass?.name ?? payload.characterState.subclass ?? "None"}</div>
                </div>
                  <div>
                    <div className="small-label">Level</div>
                    <div className="small-value">{level}</div>
                  </div>
                  <div>
                    <div className="small-label">XP</div>
                    <div className="small-value">{xp}</div>
                  </div>
                  <div>
                    <div className="small-label">Species</div>
                    <div className="small-value">{species?.name ?? "Unspecified"}</div>
                  </div>
                  <div>
                    <div className="small-label">Background</div>
                    <div className="small-value">{background?.name ?? "Unspecified"}</div>
                  </div>
                  <div>
                    <div className="small-label">Heroic Inspiration</div>
                    <div className="small-value">
                      {payload.characterState.heroicInspiration ? "Yes" : "No"}
                    </div>
                  </div>
                  <div>
                    <div className="small-label">Alignment</div>
                    <div className="small-value">{payload.characterState.alignment ?? "-"}</div>
                  </div>
                </div>
              </div>
            </header>

            <div className="page-columns">
              <div className="column-left">
                <section className="panel abilities-panel">
                  <div className="section-head">Ability Scores</div>
                  <div className="abilities-stack">
                    {ABILITIES.map((ability) => (
                      <div key={ability} className="ability-row">
                        <div className="ability-tag">{ABILITY_LABELS[ability]}</div>
                        <div className="ability-mod-badge">{formatModifier(derived.abilityMods[ability])}</div>
                        <div className="ability-score-box">{derived.finalAbilities[ability]}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel saves-panel">
                  <div className="section-head">Saving Throws</div>
                  <table className="tight-table">
                    <tbody>
                      {ABILITIES.map((ability) => (
                        <tr key={`save-${ability}`}>
                          <td className="mark-col">{saveProficiencySet.has(ability) ? "●" : "○"}</td>
                          <td>{ABILITY_LABELS[ability]}</td>
                          <td className="num-col">{formatModifier(derived.savingThrows[ability])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="panel skills-panel">
                  <div className="section-head">Skills</div>
                  <table className="tight-table">
                    <tbody>
                      {SKILL_ORDER.map((skill) => (
                        <tr key={skill}>
                          <td className="mark-col">{skillProficiencySet.has(skill) ? "●" : "○"}</td>
                          <td>{formatSkillName(skill)}</td>
                          <td className="num-col">{formatModifier(derived.skills[skill] ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>

              <div className="column-middle">
                <section className="panel combat-panel">
                  <div className="section-head">Combat</div>
                  <div className="combat-grid">
                    <div className="stat">
                      <div className="small-label">AC</div>
                      <div className="stat-value">{derived.armorClass}</div>
                    </div>
                    <div className="stat">
                      <div className="small-label">Initiative</div>
                      <div className="stat-value">{formatModifier(derived.abilityMods.dex)}</div>
                    </div>
                    <div className="stat">
                      <div className="small-label">Speed</div>
                      <div className="stat-value">{derived.speed} ft</div>
                    </div>
                    <div className="stat">
                      <div className="small-label">Prof Bonus</div>
                      <div className="stat-value">{formatModifier(derived.proficiencyBonus)}</div>
                    </div>
                    <div className="stat">
                      <div className="small-label">Passive Perception</div>
                      <div className="stat-value">{passivePerception}</div>
                    </div>
                  </div>
                </section>

                <section className="panel hp-panel">
                  <div className="section-head">Hit Points</div>
                  <div className="hp-grid">
                    <div className="stat">
                      <div className="small-label">Max HP</div>
                      <div className="stat-value">{derived.maxHP}</div>
                    </div>
                    <div className="stat">
                      <div className="small-label">Current HP</div>
                      <div className="stat-value">_____</div>
                    </div>
                    <div className="stat">
                      <div className="small-label">Temp HP</div>
                      <div className="stat-value">{tempHP}</div>
                    </div>
                  </div>
                </section>

                <section className="panel attacks-panel">
                  <div className="section-head">Attacks & Actions</div>
                  <table className="tight-table attacks-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Bonus</th>
                        <th>Damage/Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attackRows.map((attack, index) => (
                        <tr key={`attack-row-${index}`}>
                          <td>{formatAttackName(attack)}</td>
                          <td className="num-col">{attack ? formatModifier(attack.toHit) : ""}</td>
                          <td>{attack?.damage ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="panel traits-panel">
                  <div className="section-head">Features & Traits</div>
                  {traitEntries.length === 0 ? (
                    <p className="placeholder">No features selected.</p>
                  ) : (
                    <ul className="trimmed-list">
                      {traitEntries.map((entry, index) => (
                        <li key={`trait-${index}`}>{entry}</li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="column-right">
                <section className="panel profs-panel">
                  <div className="section-head">Proficiencies & Languages</div>
                  <div className="list-block">
                    <div className="small-label">Tools</div>
                    {toolProficiencies.length === 0 ? (
                      <div className="placeholder">None</div>
                    ) : (
                      <ul className="trimmed-list compact">
                        {toolProficiencies.map((tool) => (
                          <li key={tool}>{tool}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="list-block">
                    <div className="small-label">Languages</div>
                    {languages.length === 0 ? (
                      <div className="placeholder">None</div>
                    ) : (
                      <ul className="trimmed-list compact">
                        {languages.map((language) => (
                          <li key={language}>{language}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="panel inventory-panel">
                  <div className="section-head">Equipment / Inventory</div>
                  <ul className="trimmed-list compact">
                    <li>Armor: {armor?.name ?? "None"}</li>
                    <li>Shield: {shield?.name ?? "None"}</li>
                    <li>Weapon: {weapon?.name ?? "None"}</li>
                    <li>Coins: {gpCoins} gp / {spCoins} sp / {cpCoins} cp</li>
                    <li>Other: {inventoryNameList.join(", ") || "-"}</li>
                  </ul>
                </section>

                <section className="panel feats-panel">
                  <div className="section-head">Feats</div>
                  {derived.feats.length === 0 ? (
                    <div className="placeholder">None</div>
                  ) : (
                    <ul className="trimmed-list compact">
                      {derived.feats.map((feat) => (
                        <li key={feat.id}>{feat.name}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel notes-panel">
                  <div className="section-head">Notes</div>
                  <div className="notes-area" />
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className={[
          "sheet-page",
          "page-2",
          hasOverlayPage2 ? "has-overlay" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="sheet-content">
          <div className="page2-layout">
            <header className="panel page2-header">
              <div>
                <div className="sheet-title">Spells</div>
                <div className="small-value">Character: ________________________</div>
              </div>
              <div className="small-value">{klass?.name ?? "Class Unspecified"} Level {level}</div>
            </header>

            <div className="page2-columns">
              <div className="page2-left">
                <section className="panel spell-summary-panel">
                  <div className="section-head">Spellcasting Summary</div>
                  <div className="spell-summary-grid">
                    <div>
                      <div className="small-label">Spellcasting Ability</div>
                      <div className="small-value">
                        {spellcastingAbility ? ABILITY_LABELS[spellcastingAbility] : "Not available"}
                      </div>
                    </div>
                    <div>
                      <div className="small-label">Spell Save DC</div>
                      <div className="small-value">
                        {spellSaveDC ?? "Not available"}
                      </div>
                    </div>
                    <div>
                      <div className="small-label">Spell Attack Bonus</div>
                      <div className="small-value">
                        {spellAttackBonus !== null ? formatModifier(spellAttackBonus) : "Not available"}
                      </div>
                    </div>
                    <div>
                      <div className="small-label">Progression</div>
                      <div className="small-value">
                        {spellcastingProgression ?? "Not available"}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="panel spell-slots-panel">
                  <div className="section-head">Spell Slots</div>
                  <table className="tight-table">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>Slots</th>
                        <th>Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spellSlotLevels.map((slotLevel) => (
                        <tr key={`slot-${slotLevel}`}>
                          <td>{slotLevel}</td>
                          <td className="num-col">
                            {spellSlots ? (spellSlots[slotLevel - 1] ?? 0) : "-"}
                          </td>
                          <td className="num-col">
                            {spellSlots && (spellSlots[slotLevel - 1] ?? 0) > 0 ? "0" : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="panel spell-list-panel">
                  <div className="section-head">Spells Known / Prepared</div>
                  <div className="spell-list-grid">
                    <div>
                      <div className="small-label">Cantrips</div>
                      <div className="small-value-list">{cantripNames.join(", ") || "(none)"}</div>
                    </div>
                    <div>
                      <div className="small-label">Known</div>
                      <div className="small-value-list">{knownSpellNames.join(", ") || "(none)"}</div>
                    </div>
                    <div>
                      <div className="small-label">Prepared</div>
                      <div className="small-value-list">{preparedSpellNames.join(", ") || "(none)"}</div>
                    </div>
                  </div>
                  {!spellcastingAbility ? (
                    <div className="placeholder spell-placeholder">
                      No spellcasting class selected; lists shown from scaffold state.
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="page2-right">
                <section className="panel right-notes-panel">
                  <div className="section-head">Additional Notes</div>
                  <div className="notes-area tall" />
                </section>
                <section className="panel resources-panel">
                  <div className="section-head">Conditions / Resources</div>
                  <ul className="trimmed-list compact">
                    <li>Hit Dice: {hitDiceSpent}/{hitDiceTotal ?? "-"}</li>
                    <li>Death Saves: {deathSaveSuccesses}/{deathSaveFailures}</li>
                    <li>Exhaustion: {exhaustionLevel}</li>
                  </ul>
                </section>
              </div>
            </div>

            <footer className="sheet-footer">
              <div className="small-label">Dark Sun Character Builder Sheet</div>
              {attributions.length > 0 ? (
                <div className="attribution-text">
                  {attributions.join(" ")}
                </div>
              ) : (
                <div className="attribution-text">No attribution text required for selected packs.</div>
              )}
            </footer>
          </div>
        </div>
      </section>

      <style>{`
        @page {
          size: letter;
          margin: 0.35in;
        }

        html,
        body {
          height: 100%;
        }

        body {
          margin: 0;
          color: #111827;
          background: #dbe4ee;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 11px;
          line-height: 1.25;
        }

        .print-root {
          padding: 0.24in 0;
        }

        .controls {
          width: 7.8in;
          margin: 0 auto 0.14in;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-button,
        .control-link,
        .overlay-toggle {
          border: 1px solid #334155;
          border-radius: 4px;
          background: #ffffff;
          color: #0f172a;
          padding: 6px 10px;
          font-size: 12px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .sheet-page {
          position: relative;
          width: 7.8in;
          height: 10.3in;
          margin: 0 auto 0.14in;
          background: #ffffff;
          border: 1px solid #475569;
          overflow: hidden;
        }

        .sheet-content {
          position: relative;
          z-index: 1;
          height: 100%;
          padding: 0.08in;
        }

        .sheet-page.has-overlay::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0;
          background-repeat: no-repeat;
          background-position: center;
          background-size: 100% 100%;
        }

        html[data-sheet-overlay="on"] .sheet-page.has-overlay::before {
          opacity: 0.24;
        }

        .sheet-page.page-1.has-overlay::before {
          background-image: url("/sheets/template-page1.png");
        }

        .sheet-page.page-2.has-overlay::before {
          background-image: url("/sheets/template-page2.png");
        }

        .page1-layout {
          height: 100%;
          display: grid;
          grid-template-rows: 1in 9.2in;
          row-gap: 0.1in;
        }

        .panel {
          border: 1px solid #0f172a;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.95);
          overflow: hidden;
        }

        .section-head {
          border-bottom: 1px solid #0f172a;
          background: #eef2f7;
          padding: 0.03in 0.05in;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .page-header {
          display: grid;
          grid-template-columns: 4.85in 2.85in;
          column-gap: 0.1in;
          height: 1in;
        }

        .name-panel {
          padding: 0.06in;
        }

        .panel-title {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.06in;
        }

        .character-name-line {
          font-size: 23px;
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1;
          margin-top: 0.12in;
        }

        .identity-panel {
          padding: 0.06in;
        }

        .identity-grid {
          height: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.06in 0.08in;
          align-content: start;
        }

        .small-label {
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 8px;
          color: #334155;
        }

        .small-value {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .page-columns {
          display: grid;
          grid-template-columns: 2.55in 3.15in 2.1in;
          column-gap: 0.1in;
          height: 9.2in;
        }

        .column-left {
          display: grid;
          grid-template-rows: 4.05in 1.35in 3.6in;
          row-gap: 0.1in;
        }

        .column-middle {
          display: grid;
          grid-template-rows: 1.2in 1.65in 2.1in 3.95in;
          row-gap: 0.1in;
        }

        .column-right {
          display: grid;
          grid-template-rows: 1.6in 2.1in 1.1in 4.1in;
          row-gap: 0.1in;
        }

        .abilities-stack {
          display: grid;
          grid-template-rows: repeat(6, 1fr);
          gap: 0.05in;
          padding: 0.05in;
        }

        .ability-row {
          border: 1px solid #475569;
          border-radius: 2px;
          display: grid;
          grid-template-columns: 0.5in 1fr;
          grid-template-rows: 0.42in 0.24in;
          align-items: center;
          justify-items: center;
          padding: 0.02in;
        }

        .ability-tag {
          grid-column: 1;
          grid-row: 1 / span 2;
          align-self: center;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        .ability-mod-badge {
          grid-column: 2;
          grid-row: 1;
          width: 0.72in;
          height: 0.42in;
          border: 1px solid #0f172a;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 16px;
          font-weight: 700;
        }

        .ability-score-box {
          grid-column: 2;
          grid-row: 2;
          width: 0.62in;
          height: 0.2in;
          border: 1px solid #0f172a;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 700;
        }

        .tight-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }

        .tight-table td,
        .tight-table th {
          border: 1px solid #64748b;
          padding: 0.015in 0.04in;
          height: 0.14in;
        }

        .tight-table th {
          text-align: left;
          font-size: 8px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: #f1f5f9;
        }

        .mark-col {
          width: 0.17in;
          text-align: center;
        }

        .num-col {
          width: 0.35in;
          text-align: right;
          font-weight: 600;
        }

        .skills-panel .tight-table td,
        .skills-panel .tight-table th {
          font-size: 8.5px;
          height: 0.135in;
        }

        .combat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0.05in;
          padding: 0.05in;
        }

        .combat-grid .stat:nth-child(4) {
          grid-column: 1 / span 1;
        }

        .combat-grid .stat:nth-child(5) {
          grid-column: 2 / span 2;
        }

        .stat {
          border: 1px solid #64748b;
          border-radius: 2px;
          padding: 0.03in 0.04in;
          min-height: 0.44in;
        }

        .stat-value {
          margin-top: 0.02in;
          font-size: 16px;
          font-weight: 700;
          line-height: 1;
        }

        .hp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0.05in;
          padding: 0.05in;
        }

        .hp-grid .stat:nth-child(1) {
          grid-column: 1 / span 2;
        }

        .attacks-table td,
        .attacks-table th {
          height: 0.2in;
          font-size: 8.5px;
        }

        .attacks-panel,
        .traits-panel,
        .feats-panel,
        .inventory-panel,
        .profs-panel {
          display: flex;
          flex-direction: column;
        }

        .trimmed-list {
          margin: 0;
          padding: 0.05in 0.08in 0.08in 0.18in;
          font-size: 9px;
          line-height: 1.2;
          overflow: hidden;
        }

        .trimmed-list.compact {
          font-size: 8.5px;
          line-height: 1.15;
        }

        .traits-panel .trimmed-list {
          max-height: 3.45in;
        }

        .list-block {
          padding: 0.05in;
        }

        .placeholder {
          color: #64748b;
          font-size: 9px;
          padding: 0.05in;
        }

        .notes-area {
          margin: 0.05in;
          border: 1px dashed #64748b;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 0.18in,
            #cbd5e1 0.18in,
            #cbd5e1 0.19in
          );
          flex: 1;
          min-height: 0.8in;
        }

        .notes-panel {
          display: flex;
          flex-direction: column;
        }

        .page2-layout {
          height: 100%;
          display: grid;
          grid-template-rows: 0.7in 9.5in;
          row-gap: 0.1in;
        }

        .page2-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.06in;
        }

        .sheet-title {
          font-size: 20px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          line-height: 1;
        }

        .page2-columns {
          display: grid;
          grid-template-columns: 4.8in 2.9in;
          column-gap: 0.1in;
          height: 9.5in;
        }

        .page2-left {
          display: grid;
          grid-template-rows: 1.1in 1.3in 6.9in;
          row-gap: 0.1in;
        }

        .page2-right {
          display: grid;
          grid-template-rows: 7.35in 2.05in;
          row-gap: 0.1in;
        }

        .spell-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.06in;
          padding: 0.06in;
        }

        .spell-list-panel {
          display: flex;
          flex-direction: column;
        }

        .spell-list-grid {
          display: grid;
          grid-template-rows: repeat(3, auto);
          gap: 0.05in;
          padding: 0.06in;
        }

        .small-value-list {
          margin-top: 2px;
          font-size: 10px;
          min-height: 0.18in;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spell-placeholder {
          flex: 1;
        }

        .right-notes-panel,
        .resources-panel {
          display: flex;
          flex-direction: column;
        }

        .notes-area.tall {
          min-height: 6.75in;
        }

        .notes-area.short {
          min-height: 1.45in;
        }

        .sheet-footer {
          margin-top: 0.06in;
          border-top: 1px solid #64748b;
          padding-top: 0.04in;
          display: grid;
          gap: 0.03in;
        }

        .attribution-text {
          font-size: 7px;
          line-height: 1.2;
          color: #334155;
        }

        .error-page {
          display: grid;
          place-content: center;
          gap: 0.08in;
          padding: 0.2in;
        }

        .back-link {
          color: #1d4ed8;
        }

        @media print {
          body {
            background: #ffffff;
          }

          .print-root {
            padding: 0;
          }

          .sheet-page {
            margin: 0;
            border: none;
            page-break-after: always;
          }

          .sheet-page:last-of-type {
            page-break-after: auto;
          }

          .sheet-page.has-overlay::before {
            opacity: 0 !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
