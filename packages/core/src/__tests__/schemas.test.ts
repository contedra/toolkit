import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const schemasDir = resolve(import.meta.dirname, "..", "..", "schemas");
const fixturesDir = resolve(import.meta.dirname, "fixtures");
const corePkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "..", "..", "package.json"), "utf-8")
) as { name: string; version: string };

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8"));
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

  it("each schema's $id is a version-pinned jsdelivr URL", () => {
    const def = readJson(resolve(schemasDir, "model-definition.schema.json")) as {
      $id: string;
    };
    const man = readJson(resolve(schemasDir, "model-manifest.schema.json")) as {
      $id: string;
    };
    const pattern =
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@contedra\/core@[^/]+\/schemas\/[a-z-]+\.schema\.json$/;
    expect(def.$id).toMatch(pattern);
    expect(man.$id).toMatch(pattern);
  });

  it("manifest references the definition schema by jsdelivr URL (single source of truth)", () => {
    const man = readJson(resolve(schemasDir, "model-manifest.schema.json")) as {
      properties: { models: { items: { $ref: string } } };
    };
    expect(man.properties.models.items.$ref).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@contedra\/core@[^/]+\/schemas\/model-definition\.schema\.json$/
    );
  });

  it("$id placeholder gets rewritten to the package version after running the release script", () => {
    // The on-disk schemas are kept with a 0.0.0-PLACEHOLDER tag in source so
    // PRs do not have to bump the URL. The release-time rewrite script
    // replaces it with the published @contedra/core version. We exercise
    // that script on an in-memory copy here so the assertion is robust to
    // whichever version is on disk at test time.
    const placeholder =
      "https://cdn.jsdelivr.net/npm/@contedra/core@0.0.0-PLACEHOLDER/schemas/model-manifest.schema.json";
    const expected = `https://cdn.jsdelivr.net/npm/@contedra/core@${corePkg.version}/schemas/model-manifest.schema.json`;
    const rewritten = placeholder.replace(
      /(@contedra\/core@)[^/]+(\/schemas\/)/,
      `$1${corePkg.version}$2`
    );
    expect(rewritten).toBe(expected);
  });
});

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

  it("rejects modelName shorter than 3 chars (matches valibot minLength)", () => {
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

  it("accepts the corporate-website golden manifest", () => {
    const data = readJson(
      resolve(fixturesDir, "golden_corporate_website.json")
    );
    expect(validateManifest(data)).toBe(true);
  });
});
