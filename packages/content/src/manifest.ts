import { z } from "zod";

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/;

export const PackManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().regex(SEMVER_PATTERN, "version must be semver"),
    license: z.string().min(1),
    source: z.string().min(1),
    attributionText: z.string().min(1).optional()
  })
  .superRefine((value, ctx) => {
    if (value.license.startsWith("CC-BY") && !value.attributionText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attributionText"],
        message: "attributionText is required for CC-BY packs"
      });
    }
  });

export type PackManifest = z.infer<typeof PackManifestSchema>;
