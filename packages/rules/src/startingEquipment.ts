import type { Equipment, MergedContent } from "@dark-sun/content";

import type { CharacterState, DerivedStartingEquipment } from "./types";

type StartingEquipmentBundle = {
  itemIds?: string[];
  equippedArmorId?: string;
  equippedShieldId?: string;
  equippedWeaponId?: string;
};

function isArmor(item: Equipment | undefined): boolean {
  return (
    item?.type === "armor_light" ||
    item?.type === "armor_medium" ||
    item?.type === "armor_heavy"
  );
}

function resolveTypedEquipmentId(
  content: MergedContent,
  primaryId: string | undefined,
  fallbackId: string | undefined,
  isValid: (item: Equipment | undefined) => boolean,
): string | undefined {
  const primary = primaryId ? content.equipmentById[primaryId] : undefined;
  if (primaryId && isValid(primary)) {
    return primaryId;
  }

  const fallback = fallbackId ? content.equipmentById[fallbackId] : undefined;
  if (fallbackId && isValid(fallback)) {
    return fallbackId;
  }

  return undefined;
}

function collectItemIds(
  content: MergedContent,
  classBundle: StartingEquipmentBundle | undefined,
  backgroundBundle: StartingEquipmentBundle | undefined,
): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  const push = (id: string | undefined) => {
    if (!id || seen.has(id) || !content.equipmentById[id]) {
      return;
    }
    seen.add(id);
    output.push(id);
  };

  for (const id of classBundle?.itemIds ?? []) {
    push(id);
  }
  for (const id of backgroundBundle?.itemIds ?? []) {
    push(id);
  }
  push(classBundle?.equippedArmorId);
  push(classBundle?.equippedShieldId);
  push(classBundle?.equippedWeaponId);
  push(backgroundBundle?.equippedArmorId);
  push(backgroundBundle?.equippedShieldId);
  push(backgroundBundle?.equippedWeaponId);

  return output;
}

export function deriveStartingEquipment(
  state: CharacterState,
  content: MergedContent,
): DerivedStartingEquipment | undefined {
  const klass = state.selectedClassId
    ? content.classesById[state.selectedClassId]
    : undefined;
  const background = state.selectedBackgroundId
    ? content.backgroundsById[state.selectedBackgroundId]
    : undefined;
  const classBundle = klass?.startingEquipment;
  const backgroundBundle = background?.startingEquipment;

  if (!classBundle && !backgroundBundle) {
    return undefined;
  }

  const itemIds = collectItemIds(content, classBundle, backgroundBundle);
  const equippedArmorId = resolveTypedEquipmentId(
    content,
    classBundle?.equippedArmorId,
    backgroundBundle?.equippedArmorId,
    isArmor,
  );
  const equippedShieldId = resolveTypedEquipmentId(
    content,
    classBundle?.equippedShieldId,
    backgroundBundle?.equippedShieldId,
    (item) => item?.type === "shield",
  );
  const equippedWeaponId = resolveTypedEquipmentId(
    content,
    classBundle?.equippedWeaponId,
    backgroundBundle?.equippedWeaponId,
    (item) => item?.type === "weapon",
  );

  if (
    itemIds.length === 0 &&
    !equippedArmorId &&
    !equippedShieldId &&
    !equippedWeaponId
  ) {
    return undefined;
  }

  return {
    itemIds,
    equippedArmorId,
    equippedShieldId,
    equippedWeaponId,
  };
}
