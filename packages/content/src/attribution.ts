import type { MergedContent } from "./merge";

export interface AttributionBlock {
  packId: string;
  name: string;
  attributionText: string;
}

export function getAttributionBlocks(content: MergedContent): AttributionBlock[] {
  return content.manifests
    .filter((manifest) => Boolean(manifest.attributionText))
    .map((manifest) => ({
      packId: manifest.id,
      name: manifest.name,
      attributionText: manifest.attributionText ?? ""
    }));
}
