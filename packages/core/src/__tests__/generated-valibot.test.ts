import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { safeParse } from "valibot";
import { ModelDefinitionSchema } from "../../generated/model-definition.valibot.js";

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
