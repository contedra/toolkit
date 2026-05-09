import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { SCHEMA_VERSION } from "../version.js";

const schemasRoot = resolve(import.meta.dirname, "..", "..", "schemas");
const schemasDir = resolve(schemasRoot, SCHEMA_VERSION);
const fixturesDir = resolve(import.meta.dirname, "fixtures");

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

describe("JSON Schemas — ship layout", () => {
  it("ships model-definition.schema.json at the expected path", () => {
    expect(
      existsSync(resolve(schemasDir, "model-definition.schema.json"))
    ).toBe(true);
  });

  it("ships model-manifest.schema.json at the expected path", () => {
    expect(
      existsSync(resolve(schemasDir, "model-manifest.schema.json"))
    ).toBe(true);
  });

  it("each schema's $id is a schema-version-pinned jsdelivr URL", () => {
    const def = readJson(resolve(schemasDir, "model-definition.schema.json")) as {
      $id: string;
    };
    const man = readJson(resolve(schemasDir, "model-manifest.schema.json")) as {
      $id: string;
    };
    const pattern =
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@contedra\/core\/schemas\/\d+\.\d+\.\d+\/[a-z-]+\.schema\.json$/;
    expect(def.$id).toMatch(pattern);
    expect(man.$id).toMatch(pattern);
  });

  it("manifest references the definition schema by jsdelivr URL (single source of truth)", () => {
    const man = readJson(resolve(schemasDir, "model-manifest.schema.json")) as {
      properties: { models: { items: { $ref: string } } };
    };
    expect(man.properties.models.items.$ref).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@contedra\/core\/schemas\/\d+\.\d+\.\d+\/model-definition\.schema\.json$/
    );
  });

  it("each shipped schema's $id path matches the directory it lives in", () => {
    // Walks every `schemas/<version>/` directory in source and asserts the
    // version segment in $id matches the parent directory name. This is the
    // CI lint that keeps source and URL in sync without the prepack rewrite.
    for (const versionDir of readdirSync(schemasRoot)) {
      const dirPath = resolve(schemasRoot, versionDir);
      if (!statSync(dirPath).isDirectory()) continue;
      for (const entry of readdirSync(dirPath)) {
        if (!entry.endsWith(".schema.json")) continue;
        const filePath = resolve(dirPath, entry);
        const data = readJson(filePath) as { $id?: string };
        expect(typeof data.$id, `${entry} has no $id`).toBe("string");
        const m = /\/schemas\/([^/]+)\/[^/]+\.schema\.json$/.exec(data.$id ?? "");
        expect(m, `${entry} $id is not a versioned schemas URL`).not.toBeNull();
        expect(m![1], `${entry} $id version segment must equal directory ${versionDir}`).toBe(
          versionDir
        );
      }
    }
  });

  it("SCHEMA_VERSION matches the latest schema directory shipped in source", () => {
    const dirs = readdirSync(schemasRoot)
      .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
      .sort(compareSemver);
    expect(dirs.length).toBeGreaterThan(0);
    expect(dirs[dirs.length - 1]).toBe(SCHEMA_VERSION);
  });
});

function compareSemver(a: string, b: string): number {
  const [aMa, aMi, aPa] = a.split(".").map(Number);
  const [bMa, bMi, bPa] = b.split(".").map(Number);
  return aMa - bMa || aMi - bMi || aPa - bPa;
}

describe("JSON Schemas — ajv validation", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const definitionSchema = readJson(
    resolve(schemasDir, "model-definition.schema.json")
  );
  const manifestSchema = readJson(
    resolve(schemasDir, "model-manifest.schema.json")
  );
  // The manifest schema $refs the definition schema by its $id URL.
  // Register the definition schema first so ajv can resolve that $ref
  // without a network fetch.
  ajv.addSchema(definitionSchema);
  const validateDefinition = ajv.compile(definitionSchema);
  const validateManifest = ajv.compile(manifestSchema);

  it("accepts a valid single ModelDefinition fixture", () => {
    const data = readJson(resolve(fixturesDir, "blog_posts.json"));
    expect(validateDefinition(data)).toBe(true);
  });

  it("accepts a valid ModelManifest fixture", () => {
    const data = readJson(resolve(fixturesDir, "manifest_multi.json"));
    expect(validateManifest(data)).toBe(true);
  });

  it("accepts a single-entry ModelManifest fixture", () => {
    const data = readJson(resolve(fixturesDir, "manifest_single.json"));
    expect(validateManifest(data)).toBe(true);
  });

  it("accepts a manifest with duplicate entries (uniqueness is a runtime concern)", () => {
    const data = readJson(resolve(fixturesDir, "manifest_duplicate.json"));
    expect(validateManifest(data)).toBe(true);
  });

  it("accepts an empty manifest at the schema level (emptiness is a runtime concern)", () => {
    const data = readJson(resolve(fixturesDir, "manifest_empty.json"));
    expect(validateManifest(data)).toBe(true);
  });

  it("rejects a bare array against the ModelDefinition schema", () => {
    const data = readJson(resolve(fixturesDir, "bare_array.json"));
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects a bare array against the ModelManifest schema", () => {
    const data = readJson(resolve(fixturesDir, "bare_array.json"));
    expect(validateManifest(data)).toBe(false);
  });

  it("rejects a single ModelDefinition file against the ModelManifest schema", () => {
    const data = readJson(resolve(fixturesDir, "blog_posts.json"));
    expect(validateManifest(data)).toBe(false);
  });

  it("rejects manifest entries missing required fields (validated through the $ref)", () => {
    const broken = {
      models: [{ id: "blog", modelName: "blog" }],
    };
    expect(validateManifest(broken)).toBe(false);
  });

  it("rejects manifest entries whose nested properties violate the definition schema", () => {
    // Exercises the full $ref chain: ModelManifest -> ModelDefinition -> ModelProperty.
    const broken = {
      models: [
        {
          id: "blog",
          modelName: "blog",
          properties: [{ propertyName: "title", dataType: "wat" }],
        },
      ],
    };
    expect(validateManifest(broken)).toBe(false);
  });

  it("rejects entries with unknown dataType values", () => {
    const broken = {
      id: "blog",
      modelName: "blog",
      properties: [{ propertyName: "title", dataType: "wat" }],
    };
    expect(validateDefinition(broken)).toBe(false);
  });

  it("rejects modelName that does not match the lowercase pattern", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_modelname_uppercase.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects relatedOne entries missing relatedModel", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_missing_related_model.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects fieldType.element values outside the enum", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_unknown_field_type_element.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects searchPriority values outside the enum", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_search_priority.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects unknown top-level keys (additionalProperties: false)", () => {
    const broken = {
      id: "blog",
      modelName: "blog",
      properties: [
        {
          propertyName: "title",
          dataType: "string",
          fieldType: { element: "input" },
        },
      ],
      extraField: "nope",
    };
    expect(validateDefinition(broken)).toBe(false);
  });

  it("rejects modelName shorter than 3 chars (JSON Schema minLength: 3)", () => {
    const broken = {
      id: "blog",
      modelName: "ab",
      properties: [
        {
          propertyName: "title",
          dataType: "string",
          fieldType: { element: "input" },
        },
      ],
    };
    expect(validateDefinition(broken)).toBe(false);
  });

  it("rejects a string `require` value (require is boolean only)", () => {
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
    expect(validateDefinition(broken)).toBe(false);
  });

  it("accepts the full-coverage golden manifest", () => {
    const data = readJson(
      resolve(fixturesDir, "golden_full_example.json")
    );
    expect(validateManifest(data)).toBe(true);
  });

  it("accepts an asset property fixture with mediaType: image", () => {
    const data = readJson(resolve(fixturesDir, "asset_blog.json"));
    expect(validateDefinition(data)).toBe(true);
  });

  it("accepts a manifest carrying asset properties", () => {
    const data = readJson(resolve(fixturesDir, "manifest_with_asset.json"));
    expect(validateManifest(data)).toBe(true);
  });

  it("rejects an asset property without mediaType", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_asset_missing_media_type.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects an asset property with an unsupported mediaType value", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_asset_unsupported_media_type.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });

  it("rejects an asset property carrying a defaultValue (additionalProperties: false)", () => {
    const data = readJson(
      resolve(fixturesDir, "invalid_asset_with_default_value.json")
    );
    expect(validateDefinition(data)).toBe(false);
  });
});
