import type {
  Background,
  Class,
  Equipment,
  Feat,
  Feature,
  Species,
} from "@dark-sun/content";

import DebugContentClient, {
  type DebugContentData,
  type DebugPackManifestRow,
} from "./DebugContentClient";
import { getMergedContent } from "../../../src/lib/content";

export const runtime = "nodejs";

function toManifestRows(
  manifests: Array<{
    id: string;
    name: string;
    version: string;
    license: string;
  }>,
): DebugPackManifestRow[] {
  return manifests.map((manifest) => ({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    license: manifest.license,
  }));
}

function probeBackground(
  backgrounds: Background[],
  id: string,
): Background | null {
  return backgrounds.find((background) => background.id === id) ?? null;
}

export default async function DebugContentPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Debug: Content</h1>
        <p className="mt-4 text-sm">This page is disabled in production.</p>
      </main>
    );
  }

  const { packs, content } = await getMergedContent();

  const species: Species[] = content.species;
  const backgrounds: Background[] = content.backgrounds;
  const classes: Class[] = content.classes;
  const features: Feature[] = content.features;
  const feats: Feat[] = content.feats;
  const equipment: Equipment[] = content.equipment;

  const data: DebugContentData = {
    manifests: toManifestRows(packs.map((pack) => pack.manifest)),
    counts: {
      species: species.length,
      backgrounds: backgrounds.length,
      classes: classes.length,
      features: features.length,
      feats: feats.length,
      equipment: equipment.length,
    },
    samples: {
      species: species.slice(0, 5),
      backgrounds: backgrounds.slice(0, 5),
      classes: classes.slice(0, 5),
      features: features.slice(0, 5),
      feats: feats.slice(0, 5),
      equipment: equipment.slice(0, 5),
    },
    backgroundProbe: probeBackground(backgrounds, "srd52:background:acolyte"),
  };

  return <DebugContentClient data={data} />;
}
