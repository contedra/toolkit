import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadModel, detectBodyField } from "../model.js";
import type { ModelDefinition } from "../types.js";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

describe("loadModel — single ModelDefinition (Easy format)", () => {
  it("loads a valid single-model JSON file", async () => {
    const model = await loadModel(resolve(fixturesDir, "blog_posts.json"));
    expect(model.modelName).toBe("blog_posts");
    expect(model.properties).toHaveLength(5);
    expect(model.properties[0].propertyName).toBe("title");
  });

  it("returns the model when modelName matches", async () => {
    const model = await loadModel(
      resolve(fixturesDir, "blog_posts.json"),
      "blog_posts"
    );
    expect(model.modelName).toBe("blog_posts");
  });

  it("throws when modelName does not match", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "blog_posts.json"), "categories")
    ).rejects.toThrow(/modelName "categories" was requested/);
  });

  it("throws for a non-existent file", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "nonexistent.json"))
    ).rejects.toThrow();
  });

  it("throws for files missing modelName/properties", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "invalid_shape.json"))
    ).rejects.toThrow(/expected a ModelDefinition/);
  });
});

describe("loadModel — ModelManifest (multi-model format)", () => {
  it("returns the matching entry when modelName is given", async () => {
    const model = await loadModel(
      resolve(fixturesDir, "manifest_multi.json"),
      "blog_posts"
    );
    expect(model.modelName).toBe("blog_posts");
    expect(model.properties).toHaveLength(2);
  });

  it("can pick any model from the manifest", async () => {
    const model = await loadModel(
      resolve(fixturesDir, "manifest_multi.json"),
      "categories"
    );
    expect(model.modelName).toBe("categories");
  });

  it("throws when modelName is omitted on a manifest", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "manifest_multi.json"))
    ).rejects.toThrow(/Pass a modelName to disambiguate/);
  });

  it("also requires modelName for a single-entry manifest", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "manifest_single.json"))
    ).rejects.toThrow(/Pass a modelName to disambiguate/);
  });

  it("resolves a single-entry manifest when modelName matches", async () => {
    const model = await loadModel(
      resolve(fixturesDir, "manifest_single.json"),
      "blog_posts"
    );
    expect(model.modelName).toBe("blog_posts");
  });

  it("throws when modelName matches no entry", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "manifest_multi.json"), "missing")
    ).rejects.toThrow(/Model "missing" not found/);
  });

  it("throws when modelName matches multiple entries", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "manifest_duplicate.json"), "blog_posts")
    ).rejects.toThrow(/appears 2 times/);
  });
});

describe("loadModel — bare array (unsupported)", () => {
  it("rejects bare array files explicitly", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "bare_array.json"))
    ).rejects.toThrow(/bare array format is not supported/);
  });

  it("rejects bare array files even with modelName", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "bare_array.json"), "blog_posts")
    ).rejects.toThrow(/bare array format is not supported/);
  });
});

describe("detectBodyField", () => {
  const model: ModelDefinition = {
    id: "blog_posts",
    modelName: "blog_posts",
    properties: [
      { propertyName: "title", dataType: "string", fieldType: { element: "input" }, require: true },
      { propertyName: "content", dataType: "string", fieldType: { element: "markdown" } },
      { propertyName: "publishedAt", dataType: "datetime" },
    ],
  };

  it("should auto-detect markdown field as body", () => {
    expect(detectBodyField(model)).toBe("content");
  });

  it("should use explicit bodyField when specified", () => {
    expect(detectBodyField(model, "title")).toBe("title");
  });

  it("should throw when explicit bodyField does not exist", () => {
    expect(() => detectBodyField(model, "nonexistent")).toThrow(
      'bodyField "nonexistent" not found'
    );
  });

  it("should return undefined when no markdown field exists", () => {
    const noMarkdownModel: ModelDefinition = {
      id: "categories",
      modelName: "categories",
      properties: [
        { propertyName: "name", dataType: "string", fieldType: { element: "input" }, require: true },
      ],
    };
    expect(detectBodyField(noMarkdownModel)).toBeUndefined();
  });
});
