import BuilderClient from "./BuilderClient";
import {
  formatSourceLabel,
  getContentOptionsFromMerged,
  getMergedContent,
  loadAllPacks,
  parseSourcesParam,
} from "../../src/lib/content";

export const runtime = "nodejs";

export default async function BuilderPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const parsedIds = parseSourcesParam(sp.sources);
  const [allPacks, merged] = await Promise.all([
    loadAllPacks(),
    getMergedContent(parsedIds),
  ]);
  const options = getContentOptionsFromMerged(merged.content);

  const manifests = allPacks.map((pack) => ({
    id: pack.manifest.id,
    name: pack.manifest.name,
    version: pack.manifest.version,
    label: formatSourceLabel(pack.manifest),
  }));

  return (
    <BuilderClient
      manifests={manifests}
      enabledSourceIds={merged.enabledPackIds}
      sourcesParamPresent={typeof sp.sources !== "undefined"}
      content={merged.content}
      options={options}
      mergeReport={merged.report}
    />
  );
}
