import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { safeParse } from "valibot";
import {
  ModelDefinitionSchema,
  ModelManifestSchema,
} from "../../generated/1.1.0/index.js";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

describe("generated valibot — ModelDefinitionSchema", () => {
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

  it("rejects an uppercase modelName fixture", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_modelname_uppercase.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("rejects a relatedOne entry missing relatedModel", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_missing_related_model.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("rejects an unknown fieldType.element value", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_unknown_field_type_element.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("rejects an unknown searchPriority value", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_search_priority.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("rejects a non-boolean `require` value", () => {
    const broken = {
      id: "blog",
      modelName: "blog",
      properties: [
        {
          propertyName: "title",
          dataType: "string",
          fieldType: { element: "input" },
          require: "true",
        },
      ],
    };
    expect(safeParse(ModelDefinitionSchema, broken).success).toBe(false);
  });
});

describe("generated valibot — ModelManifestSchema", () => {
  it("accepts the single-entry manifest fixture", () => {
    const data = readJson(resolve(fixturesDir, "manifest_single.json"));
    const result = safeParse(ModelManifestSchema, data);
    expect(
      result.success,
      result.success ? undefined : JSON.stringify(result.issues, null, 2)
    ).toBe(true);
  });

  it("accepts the multi-entry manifest fixture (with $schema header)", () => {
    const data = readJson(resolve(fixturesDir, "manifest_multi.json"));
    const result = safeParse(ModelManifestSchema, data);
    expect(
      result.success,
      result.success ? undefined : JSON.stringify(result.issues, null, 2)
    ).toBe(true);
  });

  it("accepts the full-coverage golden manifest", () => {
    const data = readJson(resolve(fixturesDir, "golden_full_example.json"));
    const result = safeParse(ModelManifestSchema, data);
    expect(
      result.success,
      result.success ? undefined : JSON.stringify(result.issues, null, 2)
    ).toBe(true);
  });

  it("rejects a payload missing the `models` array", () => {
    expect(safeParse(ModelManifestSchema, {}).success).toBe(false);
  });

  it("rejects a manifest whose entry is not a valid ModelDefinition", () => {
    const broken = {
      models: [{ id: "blog", modelName: "blog" }],
    };
    expect(safeParse(ModelManifestSchema, broken).success).toBe(false);
  });

  it("rejects a bare ModelDefinition (not wrapped in `models`)", () => {
    const data = readJson(resolve(fixturesDir, "blog_posts.json"));
    expect(safeParse(ModelManifestSchema, data).success).toBe(false);
  });

  it("accepts a manifest containing asset properties", () => {
    const data = readJson(resolve(fixturesDir, "manifest_with_asset.json"));
    const result = safeParse(ModelManifestSchema, data);
    expect(
      result.success,
      result.success ? undefined : JSON.stringify(result.issues, null, 2)
    ).toBe(true);
  });
});

describe("generated valibot — AssetProperty", () => {
  it("accepts an asset property fixture with mediaType: image", () => {
    const data = readJson(resolve(fixturesDir, "asset_blog.json"));
    const result = safeParse(ModelDefinitionSchema, data);
    expect(
      result.success,
      result.success ? undefined : JSON.stringify(result.issues, null, 2)
    ).toBe(true);
  });

  it("rejects an asset property without mediaType", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_asset_missing_media_type.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("rejects an asset property with an unsupported mediaType value", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_asset_unsupported_media_type.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("rejects an asset property carrying a defaultValue (additionalProperties: false)", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_asset_with_default_value.json")
    );
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });

  it("accepts an optional asset property without `require`", () => {
    const data = {
      id: "blog",
      modelName: "blog",
      properties: [
        { propertyName: "thumbnail", dataType: "asset", mediaType: "image" },
      ],
    };
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(true);
  });

  it("rejects an asset property with an unknown extra key", () => {
    const data = {
      id: "blog",
      modelName: "blog",
      properties: [
        {
          propertyName: "cover",
          dataType: "asset",
          mediaType: "image",
          extra: "nope",
        },
      ],
    };
    expect(safeParse(ModelDefinitionSchema, data).success).toBe(false);
  });
});
