import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseMarkdownFile, parseMarkdownString } from "../parser.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

describe("parseMarkdownString", () => {
  it("extracts frontmatter and body", () => {
    const md = `---
title: Test
date: 2024-01-01
---

Hello world`;

    const result = parseMarkdownString(md);
    expect(result.frontmatter).toEqual({
      title: "Test",
      date: new Date("2024-01-01"),
    });
    expect(result.body).toBe("Hello world");
  });

  it("handles empty body", () => {
    const md = `---
title: Empty
---`;

    const result = parseMarkdownString(md);
    expect(result.frontmatter).toEqual({ title: "Empty" });
    expect(result.body).toBe("");
  });

  it("handles empty frontmatter", () => {
    const md = `---
---

Just content`;

    const result = parseMarkdownString(md);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("Just content");
  });
});

describe("parseMarkdownFile", () => {
  it("parses a fixture file", async () => {
    const result = await parseMarkdownFile(
      path.join(FIXTURES, "sample-post.md")
    );
    expect(result.frontmatter.title).toBe("Hello World");
    expect(result.frontmatter.tags).toEqual(["tag-1", "tag-2"]);
    expect(result.body).toContain("sample blog post");
    expect(result.body).toContain("![hero](./images/hero.png)");
  });
});
