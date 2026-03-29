import { describe, it, expect } from "vitest";
import { generateDocId } from "../importer.js";

describe("generateDocId", () => {
  it("generates slug from simple filename", () => {
    expect(generateDocId("hello-world.md")).toBe("hello-world");
  });

  it("slugifies filenames with spaces", () => {
    expect(generateDocId("My Blog Post.md")).toBe("my-blog-post");
  });

  it("slugifies filenames with special characters", () => {
    expect(generateDocId("Post #1: The Beginning.md")).toBe(
      "post-1-the-beginning"
    );
  });

  it("handles nested paths", () => {
    expect(generateDocId("content/posts/hello-world.md")).toBe("hello-world");
  });
});
