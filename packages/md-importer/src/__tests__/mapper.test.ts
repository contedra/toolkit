import { describe, it, expect } from "vitest";
import type { ModelDefinition } from "@contedra/core";
import { mapFields } from "../mapper.js";

const blogModel: ModelDefinition = {
  id: "blog_posts",
  modelName: "blog_posts",
  properties: [
    {
      propertyName: "title",
      dataType: "string",
      fieldType: { element: "input" },
      require: true,
    },
    {
      propertyName: "content",
      dataType: "string",
      fieldType: { element: "markdown" },
    },
    { propertyName: "publishedAt", dataType: "datetime" },
    {
      propertyName: "tags",
      dataType: "relatedMany",
      relatedModel: "tags",
    },
  ],
};

describe("mapFields", () => {
  it("auto-matches frontmatter keys to model properties", () => {
    const frontmatter = {
      title: "Hello",
      publishedAt: "2024-01-15",
      tags: ["tag-1", "tag-2"],
    };

    const result = mapFields(frontmatter, blogModel);
    expect(result.data.title).toBe("Hello");
    expect(result.data.publishedAt).toEqual(new Date("2024-01-15"));
    expect(result.data.tags).toEqual(["tag-1", "tag-2"]);
    expect(result.unmapped).toEqual([]);
  });

  it("applies explicit field mapping", () => {
    const frontmatter = {
      headline: "Mapped",
      pubDate: "2024-03-01",
      categories: ["cat-1"],
    };

    const mapping = {
      headline: "title",
      pubDate: "publishedAt",
      categories: "tags",
    };

    const result = mapFields(frontmatter, blogModel, mapping);
    expect(result.data.title).toBe("Mapped");
    expect(result.data.publishedAt).toEqual(new Date("2024-03-01"));
    expect(result.data.tags).toEqual(["cat-1"]);
    expect(result.unmapped).toEqual([]);
  });

  it("reports unmapped frontmatter keys", () => {
    const frontmatter = {
      title: "Test",
      author: "Alice",
      draft: true,
    };

    const result = mapFields(frontmatter, blogModel);
    expect(result.data.title).toBe("Test");
    expect(result.unmapped).toEqual(
      expect.arrayContaining(["author", "draft"])
    );
  });

  it("coerces datetime strings to Date", () => {
    const frontmatter = { publishedAt: "2024-06-15T10:00:00Z" };
    const result = mapFields(frontmatter, blogModel);
    expect(result.data.publishedAt).toBeInstanceOf(Date);
  });

  it("coerces relatedMany single value to array", () => {
    const frontmatter = { tags: "single-tag" };
    const result = mapFields(frontmatter, blogModel);
    expect(result.data.tags).toEqual(["single-tag"]);
  });
});
