import { describe, it, expect } from "vitest";
import { dataTypeToZod, buildSchema } from "../schema.js";
import type { ModelProperty } from "../types.js";

describe("dataTypeToZod", () => {
  it("should convert string dataType to z.string()", () => {
    const prop: ModelProperty = {
      propertyName: "title",
      dataType: "string",
      require: true,
    };
    const schema = dataTypeToZod(prop);
    expect(schema.parse("hello")).toBe("hello");
    expect(() => schema.parse(undefined)).toThrow();
  });

  it("should make field optional when require is not true", () => {
    const prop: ModelProperty = {
      propertyName: "subtitle",
      dataType: "string",
    };
    const schema = dataTypeToZod(prop);
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse("hello")).toBe("hello");
  });

  it("should convert datetime dataType to z.coerce.date()", () => {
    const prop: ModelProperty = {
      propertyName: "publishedAt",
      dataType: "datetime",
    };
    const schema = dataTypeToZod(prop);
    const date = schema.parse("2024-01-01");
    expect(date).toBeInstanceOf(Date);
  });

  it("should convert relatedOne to z.string()", () => {
    const prop: ModelProperty = {
      propertyName: "category",
      dataType: "relatedOne",
      relatedModel: "categories",
    };
    const schema = dataTypeToZod(prop);
    expect(schema.parse("cat-123")).toBe("cat-123");
  });

  it("should convert relatedMany to z.array(z.string())", () => {
    const prop: ModelProperty = {
      propertyName: "tags",
      dataType: "relatedMany",
      relatedModel: "tags",
    };
    const schema = dataTypeToZod(prop);
    expect(schema.parse(["tag-1", "tag-2"])).toEqual(["tag-1", "tag-2"]);
  });
});

describe("buildSchema", () => {
  const properties: ModelProperty[] = [
    { propertyName: "title", dataType: "string", require: true },
    { propertyName: "content", dataType: "string", fieldType: { element: "markdown" } },
    { propertyName: "publishedAt", dataType: "datetime" },
    { propertyName: "category", dataType: "relatedOne", relatedModel: "categories" },
  ];

  it("should build a schema from properties", () => {
    const schema = buildSchema(properties);
    const result = schema.parse({
      title: "Hello",
      content: "World",
      publishedAt: "2024-01-01",
      category: "cat-1",
    });
    expect(result.title).toBe("Hello");
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it("should exclude bodyField from schema", () => {
    const schema = buildSchema(properties, "content");
    const shape = schema.shape;
    expect(shape).toHaveProperty("title");
    expect(shape).not.toHaveProperty("content");
    expect(shape).toHaveProperty("publishedAt");
  });
});
