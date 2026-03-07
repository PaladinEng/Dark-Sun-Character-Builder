import Link from "next/link";
import type { Ability, CharacterState } from "@dark-sun/rules";
import { computeDerivedState, validateCharacter } from "@dark-sun/rules";

import { getMergedContent } from "../../src/lib/content";

export const runtime = "nodejs";

type SheetPayload = {
  characterState: CharacterState;
  enabledPackIds: string[];
};

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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

function normalizeOptionalNonNegativeInt(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeCharacterState(input: CharacterState): CharacterState {
  const coins = isObjectRecord(input.coins) ? input.coins : undefined;
  return {
    ...input,
    chosenSkillProficiencies: Array.isArray(input.chosenSkillProficiencies)
      ? input.chosenSkillProficiencies
      : [],
    chosenSaveProficiencies: Array.isArray(input.chosenSaveProficiencies)
      ? input.chosenSaveProficiencies
      : [],
    knownSpellIds: Array.isArray(input.knownSpellIds) ? input.knownSpellIds : [],
    preparedSpellIds: Array.isArray(input.preparedSpellIds) ? input.preparedSpellIds : [],
    cantripsKnownIds: Array.isArray(input.cantripsKnownIds) ? input.cantripsKnownIds : [],
    selectedFeats: Array.isArray(input.selectedFeats) ? input.selectedFeats : [],
    selectedFeatureIds: Array.isArray(input.selectedFeatureIds) ? input.selectedFeatureIds : [],
    abilityIncreases: Array.isArray(input.abilityIncreases) ? input.abilityIncreases : [],
    advancements: Array.isArray(input.advancements) ? input.advancements : [],
    inventoryItemIds: Array.isArray(input.inventoryItemIds) ? input.inventoryItemIds : [],
    inventoryEntries: Array.isArray(input.inventoryEntries) ? input.inventoryEntries : [],
    armorProficiencies: normalizeStringArray(input.armorProficiencies),
    weaponProficiencies: normalizeStringArray(input.weaponProficiencies),
    toolProficiencies: normalizeStringArray(input.toolProficiencies),
    languages: normalizeStringArray(input.languages),
    attunedItems: normalizeStringArray(input.attunedItems),
    subclass: normalizeOptionalString(input.subclass),
    xp: normalizeOptionalNonNegativeInt(input.xp),
    heroicInspiration: input.heroicInspiration === true,
    tempHP: normalizeOptionalNonNegativeInt(input.tempHP),
    hitDiceTotal: normalizeOptionalNonNegativeInt(input.hitDiceTotal),
    hitDiceSpent: normalizeOptionalNonNegativeInt(input.hitDiceSpent),
    deathSaveSuccesses: normalizeOptionalNonNegativeInt(input.deathSaveSuccesses),
    deathSaveFailures: normalizeOptionalNonNegativeInt(input.deathSaveFailures),
    exhaustionLevel: normalizeOptionalNonNegativeInt(input.exhaustionLevel),
    otherWealth: normalizeOptionalString(input.otherWealth),
    appearance: normalizeOptionalString(input.appearance),
    physicalDescription: normalizeOptionalString(input.physicalDescription),
    backstory: normalizeOptionalString(input.backstory),
    alignment: normalizeOptionalString(input.alignment),
    notes: normalizeOptionalString(input.notes),
    companion: isObjectRecord(input.companion)
      ? {
          name: normalizeOptionalString(input.companion.name),
          type: normalizeOptionalString(input.companion.type),
          summary: normalizeOptionalString(input.companion.summary),
          notes: normalizeOptionalString(input.companion.notes),
        }
      : undefined,
    coins: coins
      ? {
          cp: normalizeOptionalNonNegativeInt(coins.cp),
          sp: normalizeOptionalNonNegativeInt(coins.sp),
          ep: normalizeOptionalNonNegativeInt(coins.ep),
          gp: normalizeOptionalNonNegativeInt(coins.gp),
          pp: normalizeOptionalNonNegativeInt(coins.pp),
        }
      : undefined,
  };
}

function decodePayload(raw: string | string[] | undefined): SheetPayload | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<SheetPayload>;
    if (!isObjectRecord(parsed.characterState)) {
      return null;
    }
    return {
      characterState: normalizeCharacterState(parsed.characterState as CharacterState),
      enabledPackIds: Array.isArray(parsed.enabledPackIds)
        ? parsed.enabledPackIds.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatSkillName(skillId: string): string {
  return skillId
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSpellSlots(slots: readonly number[] | null | undefined): string {
  if (!slots) {
    return "None";
  }
  return slots.map((count, index) => `L${index + 1}:${count}`).join(" ");
}

export default async function SheetPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const payload = decodePayload(params.payload);

  if (!payload) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6 text-slate-100">
        <h1 className="text-2xl font-semibold">Character Sheet</h1>
        <p className="text-sm text-slate-300">
          Missing payload. Open Builder and use Open HTML Sheet to generate a payload-backed sheet URL.
        </p>
        <Link href="/builder" className="text-sm text-sky-300 underline">
          Back to Builder
        </Link>
      </main>
    );
  }

  const merged = await getMergedContent(payload.enabledPackIds);
  const derived = computeDerivedState(payload.characterState, merged.content);
  const validation = validateCharacter(payload.characterState, merged.content);

  const selectedClass = payload.characterState.selectedClassId
    ? merged.content.classesById[payload.characterState.selectedClassId]
    : undefined;
  const selectedSpecies = payload.characterState.selectedSpeciesId
    ? merged.content.speciesById[payload.characterState.selectedSpeciesId]
    : undefined;
  const selectedBackground = payload.characterState.selectedBackgroundId
    ? merged.content.backgroundsById[payload.characterState.selectedBackgroundId]
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
  const cpCoins = Number.isFinite(coinValues.cp) ? Math.max(0, Math.floor(coinValues.cp ?? 0)) : 0;
  const spCoins = Number.isFinite(coinValues.sp) ? Math.max(0, Math.floor(coinValues.sp ?? 0)) : 0;
  const epCoins = Number.isFinite(coinValues.ep) ? Math.max(0, Math.floor(coinValues.ep ?? 0)) : 0;
  const gpCoins = Number.isFinite(coinValues.gp) ? Math.max(0, Math.floor(coinValues.gp ?? 0)) : 0;
  const ppCoins = Number.isFinite(coinValues.pp) ? Math.max(0, Math.floor(coinValues.pp ?? 0)) : 0;

  const inventoryCounts = new Map<string, number>();
  for (const itemId of payload.characterState.inventoryItemIds ?? []) {
    inventoryCounts.set(itemId, Math.max(1, inventoryCounts.get(itemId) ?? 1));
  }
  for (const entry of payload.characterState.inventoryEntries ?? []) {
    const quantity =
      typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? Math.max(1, Math.floor(entry.quantity))
        : 1;
    inventoryCounts.set(entry.itemId, Math.max(quantity, inventoryCounts.get(entry.itemId) ?? 0));
  }
  const inventoryItems = [...inventoryCounts.entries()]
    .map(([itemId, quantity]) => {
      const label = merged.content.equipmentById[itemId]?.name ?? itemId;
      return quantity > 1 ? `${label} x${quantity}` : label;
    })
    .sort((a, b) => a.localeCompare(b));

  const orderedSkillIds = [
    ...SKILL_ORDER,
    ...Object.keys(derived.skills)
      .filter((skillId) => !SKILL_ORDER.includes(skillId as (typeof SKILL_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b)),
  ];
  const saveProficiencies = new Set(derived.saveProficiencies ?? []);
  const attackSummary = derived.attack
    ? `${derived.attack.name} ${formatModifier(derived.attack.toHit)} (${derived.attack.damage})`
    : "None";
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellcastingModifier = spellcastingAbility ? derived.abilityMods[spellcastingAbility] : null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus = derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;
  const shieldAC = payload.characterState.equippedShieldId ? 2 : 0;

  return (
    <main className="min-h-screen bg-slate-300 px-3 py-6 text-slate-950">
      <article className="mx-auto max-w-6xl overflow-hidden rounded border-2 border-slate-900 bg-white shadow-2xl">
        <header className="border-b-2 border-slate-900 px-4 py-3">
          <h1 className="text-xl font-bold tracking-wide">Dark Sun Character Sheet</h1>
          <div className="mt-2 grid gap-2 text-sm md:grid-cols-7">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Class</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">{selectedClass?.name ?? "Unset"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Subclass</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">{payload.characterState.subclass ?? "-"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Species</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">{selectedSpecies?.name ?? "Unset"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Background</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">{selectedBackground?.name ?? "Unset"}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Level</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">{payload.characterState.level}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">XP</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">{payload.characterState.xp ?? 0}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Heroic Inspiration</div>
              <div className="border-b border-slate-900 pb-0.5 font-semibold">
                {payload.characterState.heroicInspiration ? "Yes" : "No"}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Abilities
              </h2>
              <div className="grid gap-2 p-2">
                {ABILITIES.map((ability) => (
                  <div key={ability} className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-900 p-2">
                    <div>
                      <div className="text-xs font-semibold tracking-wide">{ABILITY_LABELS[ability]}</div>
                      <div className="text-[11px] text-slate-700">Score {derived.finalAbilities[ability]}</div>
                    </div>
                    <div className="h-10 w-10 rounded-full border border-slate-900 text-center text-lg font-bold leading-10">
                      {formatModifier(derived.abilityMods[ability])}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Saving Throws
              </h2>
              <div className="space-y-1 p-2 text-sm">
                {ABILITIES.map((ability) => (
                  <div key={`save-${ability}`} className="flex items-center justify-between">
                    <span>
                      {saveProficiencies.has(ability) ? "* " : "- "}
                      {ABILITY_LABELS[ability]}
                    </span>
                    <span className="font-semibold">{formatModifier(derived.savingThrows[ability])}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-3">
            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Core Combat Stats
              </h2>
              <div className="grid grid-cols-2 gap-2 p-2 text-sm md:grid-cols-3">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Armor Class</div>
                  <div className="text-lg font-bold">{derived.armorClass}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Shield AC</div>
                  <div className="text-lg font-bold">{shieldAC}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Max HP</div>
                  <div className="text-lg font-bold">{derived.maxHP}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Temp HP</div>
                  <div className="text-lg font-bold">{payload.characterState.tempHP ?? 0}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Speed</div>
                  <div className="text-lg font-bold">{derived.speed} ft</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Hit Dice</div>
                  <div className="text-lg font-bold">
                    {payload.characterState.hitDiceSpent ?? 0}/{payload.characterState.hitDiceTotal ?? "-"}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Death Saves</div>
                  <div className="text-lg font-bold">
                    {payload.characterState.deathSaveSuccesses ?? 0} / {payload.characterState.deathSaveFailures ?? 0}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Exhaustion</div>
                  <div className="text-lg font-bold">{payload.characterState.exhaustionLevel ?? 0}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Proficiency</div>
                  <div className="text-lg font-bold">{formatModifier(derived.proficiencyBonus)}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Passive Perception</div>
                  <div className="text-lg font-bold">{derived.passivePerception}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Skills
              </h2>
              <div className="max-h-[360px] overflow-auto p-2">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {orderedSkillIds.map((skillId) => (
                      <tr key={`skill-${skillId}`} className="border-b border-slate-200">
                        <td className="py-1 pr-2">{formatSkillName(skillId)}</td>
                        <td className="py-1 text-right font-semibold">
                          {formatModifier(derived.skills[skillId] ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Attacks & Spellcasting
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Primary Attack</div>
                  <div className="font-semibold">{attackSummary}</div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spellcasting Ability</div>
                    <div className="font-semibold">{spellcastingAbility ? ABILITY_LABELS[spellcastingAbility] : "None"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Save DC</div>
                    <div className="font-semibold">{spellSaveDC ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spellcasting Modifier</div>
                    <div className="font-semibold">
                      {spellcastingModifier !== null ? formatModifier(spellcastingModifier) : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Attack Bonus</div>
                    <div className="font-semibold">
                      {spellAttackBonus !== null ? formatModifier(spellAttackBonus) : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Slots</div>
                    <div className="font-semibold">{formatSpellSlots(spellSlots)}</div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-3">
            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Equipment & Inventory
              </h2>
              <ul className="space-y-1 p-2 text-sm">
                <li>Armor: {armor?.name ?? "None"}</li>
                <li>Shield: {shield?.name ?? "None"}</li>
                <li>Weapon: {weapon?.name ?? "None"}</li>
                <li>Coins: {cpCoins} cp / {spCoins} sp / {epCoins} ep / {gpCoins} gp / {ppCoins} pp</li>
                <li>Other Wealth: {payload.characterState.otherWealth || "None"}</li>
                <li>Attuned Items: {payload.characterState.attunedItems?.join(", ") || "None"}</li>
                <li>Other Gear: {inventoryItems.join(", ") || "None"}</li>
              </ul>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Feats
              </h2>
              {derived.feats.length === 0 ? (
                <p className="p-2 text-sm">None</p>
              ) : (
                <ul className="space-y-1 p-2 text-sm">
                  {derived.feats.map((feat) => (
                    <li key={feat.id}>{feat.name}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Proficiencies
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Armor</div>
                  <div>{payload.characterState.armorProficiencies?.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Weapons</div>
                  <div>{payload.characterState.weaponProficiencies?.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Tools</div>
                  <div>{derived.toolProficiencies.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Languages</div>
                  <div>{derived.languages.join(", ") || "None"}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Narrative
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Alignment</div>
                  <div>{payload.characterState.alignment || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Appearance</div>
                  <div>{payload.characterState.appearance || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Physical Description</div>
                  <div>{payload.characterState.physicalDescription || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Backstory</div>
                  <div>{payload.characterState.backstory || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Notes</div>
                  <div>{payload.characterState.notes || "None"}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Companion / Familiar
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Name</div>
                  <div>{payload.characterState.companion?.name || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Type</div>
                  <div>{payload.characterState.companion?.type || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Summary</div>
                  <div>{payload.characterState.companion?.summary || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Notes</div>
                  <div>{payload.characterState.companion?.notes || "None"}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Validation
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div className="font-semibold">Export Ready: {validation.isValidForExport ? "YES" : "NO"}</div>
                {validation.errors.length > 0 ? (
                  <ul className="space-y-1 text-rose-700">
                    {validation.errors.map((issue, index) => (
                      <li key={`error-${index}`}>[{issue.code}] {issue.message}</li>
                    ))}
                  </ul>
                ) : null}
                {validation.warnings.length > 0 ? (
                  <ul className="space-y-1 text-amber-700">
                    {validation.warnings.map((issue, index) => (
                      <li key={`warning-${index}`}>[{issue.code}] {issue.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          </div>
        </div>
        <footer className="border-t-2 border-slate-900 bg-slate-100 px-4 py-2 text-xs">
          <Link href="/builder" className="underline">
            Back to Builder
          </Link>
          <span className="ml-2 text-slate-600">Payload packs: {payload.enabledPackIds.join(", ") || "(none)"}</span>
        </footer>
      </article>
    </main>
  );
}
