import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { transformDocumentData } from "../firestore.js";
import type { ModelDefinition } from "../types.js";

const model: ModelDefinition = {
  id: "blog_posts",
  modelName: "blog_posts",
  properties: [
    { propertyName: "title", dataType: "string", fieldType: { element: "input" }, require: true },
    { propertyName: "content", dataType: "string", fieldType: { element: "markdown" } },
    { propertyName: "publishedAt", dataType: "datetime" },
    { propertyName: "category", dataType: "relatedOne", relatedModel: "categories" },
    { propertyName: "tags", dataType: "relatedMany", relatedModel: "tags" },
  ],
};

describe("transformDocumentData", () => {
  it("should separate body field from data", () => {
    const result = transformDocumentData(
      {
        title: "Hello",
        content: "# My Post",
        publishedAt: new Date("2024-01-01"),
        category: "cat-1",
        tags: ["tag-1", "tag-2"],
      },
      model,
      "content"
    );

    expect(result.body).toBe("# My Post");
    expect(result.data).not.toHaveProperty("content");
    expect(result.data.title).toBe("Hello");
  });

  it("should convert Firestore Timestamp to Date", () => {
    const ts = Timestamp.fromDate(new Date("2024-06-15T00:00:00Z"));
    const result = transformDocumentData(
      {
        title: "Hello",
        publishedAt: ts,
        category: "cat-1",
        tags: [],
      },
      model,
      "content"
    );

    expect(result.data.publishedAt).toBeInstanceOf(Date);
    expect((result.data.publishedAt as Date).toISOString()).toBe(
      "2024-06-15T00:00:00.000Z"
    );
  });

  it("should extract document ID from Firestore reference-like objects", () => {
    const result = transformDocumentData(
      {
        title: "Hello",
        category: { id: "cat-123", path: "categories/cat-123" },
        tags: [
          { id: "tag-1", path: "tags/tag-1" },
          { id: "tag-2", path: "tags/tag-2" },
        ],
      },
      model,
      "content"
    );

    expect(result.data.category).toBe("cat-123");
    expect(result.data.tags).toEqual(["tag-1", "tag-2"]);
  });

  it("should handle missing optional fields", () => {
    const result = transformDocumentData(
      { title: "Hello" },
      model,
      "content"
    );

    expect(result.data.title).toBe("Hello");
    expect(result.data.publishedAt).toBeUndefined();
    expect(result.body).toBeUndefined();
  });

  it("should include all fields in data when no bodyField", () => {
    const result = transformDocumentData(
      {
        title: "Hello",
        content: "# My Post",
      },
      model
    );

    expect(result.body).toBeUndefined();
    expect(result.data.content).toBe("# My Post");
    expect(result.data.title).toBe("Hello");
  });
});
