# Spellcasting Scaffold Plan (2024 RAW Baseline)

## Scope
- In scope: class-level spellcasting ability, spell save DC, spell attack bonus, per-level slot counts for single-class characters, and spell content wiring (spell entities, spell lists, known/prepared id scaffolding).
- Out of scope: spell selection UX, multiclass slot progression, and pact magic slot mechanics.

## Data Model
- Class content metadata:
  - `spellcasting.ability`: any ability score id (`str|dex|con|int|wis|cha`)
  - `spellcasting.progression`: `full | half | third | pact`
  - `spellcasting.mode` (placeholder only): `prepared | known`
  - `spellListRefs?: string[]` references content spell lists
- Content entities:
  - `Spell` with minimal casting metadata (`level`, `school`, `castingTime`, `range`, `components`, `duration`, etc.)
  - `SpellList` with `spellIds: string[]`
- DerivedState scaffold fields:
  - `spellcastingAbility: int | wis | cha | null`
  - `spellSaveDC: number | null`
  - `spellAttackBonus: number | null`
  - `spellSlots: Record<number, number> | null` (keys 1..9)

For non-spellcasters, all four fields are `null`.

## Formulas
- `spellSaveDC = 8 + proficiencyBonus + abilityModifier(spellcastingAbility)`
- `spellAttackBonus = proficiencyBonus + abilityModifier(spellcastingAbility)`

## Slot Tables
- Slot data lives in `packages/rules/src/spellSlots.ts`.
- Query API: `getSpellSlots(level, progression)`.
- First baseline supports `full`, `half`, and `third` progression tables (level 1..20, slot levels 1..9).
- `pact` is intentionally scaffold-only in this milestone and now triggers `SPELLCASTING_PACT_UNIMPLEMENTED` validation error for export gating.

## Prepared/Known Scaffold
- `CharacterState` carries optional arrays:
  - `knownSpellIds`
  - `preparedSpellIds`
  - `cantripsKnownIds`
- `DerivedState.spellcasting` mirrors these ids in sorted deterministic order.
- Validation currently enforces only that referenced spell ids exist (`SPELL_ID_MISSING`), without class legality enforcement yet.

## Test Strategy
- Unit tests cover spellcasting math, slot table lookups, and validation/error behavior (`pact` stub, missing spell ids).
- Golden fixtures cover deterministic DerivedState outputs.
- Spellcasting fixtures cover full/half/third progression levels.
- Invariant check: if `spellcastingAbility` is non-null, `spellSaveDC` and `spellAttackBonus` are non-null and match formulas.
