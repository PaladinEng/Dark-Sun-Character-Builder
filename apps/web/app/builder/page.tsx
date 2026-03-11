import BuilderClient from "./BuilderClient";
import {
  formatSourceLabel,
  getContentOptionsFromMerged,
  getMergedContent,
  loadAllPacks,
  parseSourcesParam,
} from "../../src/lib/content";
import {
  applySettingRestrictions,
  getResolvedPackSettings,
} from "../../src/lib/packSettings";

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
  const settingProfile = await getResolvedPackSettings(merged.enabledPackIds);
  const options = applySettingRestrictions(
    getContentOptionsFromMerged(merged.content),
    settingProfile,
  );

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
      settingProfile={settingProfile}
      mergeReport={merged.report}
    />
  );
}
