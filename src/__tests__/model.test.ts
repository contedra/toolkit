import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { loadModel, detectBodyField } from "../model.js";
import type { ModelDefinition } from "../types.js";

const fixturesDir = resolve(import.meta.dirname, "fixtures");

describe("loadModel", () => {
  it("should load a valid model JSON file", async () => {
    const model = await loadModel(resolve(fixturesDir, "blog_posts.json"));
    expect(model.modelName).toBe("blog_posts");
    expect(model.properties).toHaveLength(5);
    expect(model.properties[0].propertyName).toBe("title");
  });

  it("should throw for a non-existent file", async () => {
    await expect(
      loadModel(resolve(fixturesDir, "nonexistent.json"))
    ).rejects.toThrow();
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
