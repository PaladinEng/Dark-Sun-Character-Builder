import type {
  CharacterState,
  ConditionId,
  DerivedModifier,
  DerivedModifierEffect,
  DerivedState
} from "./types";

function resolveConditionModifiers(
  state: CharacterState
): { activeConditionIds: ConditionId[]; modifiers: DerivedModifier[] } {
  const activeConditionIds: ConditionId[] = [];
  const modifiers: DerivedModifier[] = [];

  if (state.conditions?.encumbered === true) {
    activeConditionIds.push("encumbered");
    modifiers.push({
      id: "condition:encumbered:speed-minus-10",
      source: "condition",
      sourceId: "encumbered",
      label: "Encumbered",
      effects: [{ type: "add_speed", value: -10 }]
    });
  }

  return {
    activeConditionIds,
    modifiers
  };
}

function applyModifierEffect(base: DerivedState, effect: DerivedModifierEffect): DerivedState {
  if (effect.type === "add_speed") {
    return {
      ...base,
      speed: Math.max(0, base.speed + effect.value)
    };
  }
  return base;
}

export function applyDerivedModifierPipeline(
  base: DerivedState,
  state: CharacterState
): DerivedState {
  const { activeConditionIds, modifiers } = resolveConditionModifiers(state);
  const withAdjustedValues = modifiers.reduce((current, modifier) => {
    return modifier.effects.reduce((accumulator, effect) => {
      return applyModifierEffect(accumulator, effect);
    }, current);
  }, base);

  if (activeConditionIds.length === 0 && modifiers.length === 0) {
    return withAdjustedValues;
  }

  return {
    ...withAdjustedValues,
    ...(activeConditionIds.length > 0 ? { activeConditionIds } : {}),
    ...(modifiers.length > 0 ? { appliedModifiers: modifiers } : {})
  };
}
