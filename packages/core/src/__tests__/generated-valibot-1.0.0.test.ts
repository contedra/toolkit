import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { safeParse } from "valibot";
import {
  ModelDefinitionSchema,
  ModelManifestSchema,
} from "../../generated/1.0.0/index.js";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

// Regression coverage for `@contedra/core/generated/1.0.0` — the schema and
// generated valibot module shipped before AssetProperty was introduced. We
// keep these alive so old consumers that pin `generated/1.0.0/...` don't
// silently break when 1.1.0 is released.

describe("generated valibot 1.0.0 — ModelDefinitionSchema (regression)", () => {
  it("accepts every model in the golden manifest", () => {
    const manifest = readJson(
      resolve(fixturesDir, "golden_full_example.json")
    ) as { models: unknown[] };
    expect(manifest.models.length).toBeGreaterThan(0);
    for (const model of manifest.models) {
      const result = safeParse(ModelDefinitionSchema, model);
      expect(
        result.success,
        result.success ? undefined : JSON.stringify(result.issues, null, 2)
      ).toBe(true);
    }
  });

  it("accepts the single-model fixture", () => {
    const data = readJson(resolve(fixturesDir, "blog_posts.json"));
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(true);
  });

  it("rejects an asset dataType (not part of 1.0.0)", () => {
    const data = readJson(resolve(fixturesDir, "asset_blog.json"));
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });
});

describe("generated valibot 1.0.0 — ModelManifestSchema (regression)", () => {
  it("accepts the multi-entry manifest fixture", () => {
    const data = readJson(resolve(fixturesDir, "manifest_multi.json"));
    expect(safeParse(ModelManifestSchema, data).success).toBe(true);
  });

  it("accepts the full-coverage golden manifest", () => {
    const data = readJson(resolve(fixturesDir, "golden_full_example.json"));
    expect(safeParse(ModelManifestSchema, data).success).toBe(true);
  });

  it("rejects a manifest carrying an asset property (1.0.0 has no AssetProperty)", () => {
    const data = readJson(resolve(fixturesDir, "manifest_with_asset.json"));
    expect(safeParse(ModelManifestSchema, data).success).toBe(false);
  });
});
