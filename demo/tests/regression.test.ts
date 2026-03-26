import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const distDir = resolve(import.meta.dirname, "../dist");

function normalizeHtml(html: string): string {
  // Remove Astro's generated data-astro-cid-* attributes which change between builds
  return html.replace(/\s*data-astro-cid-[a-z0-9]+/g, "");
}

describe("Demo site regression", () => {
  it("index page matches snapshot", () => {
    const html = readFileSync(resolve(distDir, "index.html"), "utf-8");
    expect(normalizeHtml(html)).toMatchSnapshot();
  });

  it("post: getting-started-with-astro matches snapshot", () => {
    const html = readFileSync(
      resolve(distDir, "posts/getting-started-with-astro/index.html"),
      "utf-8"
    );
    expect(normalizeHtml(html)).toMatchSnapshot();
  });

  it("post: firebase-for-content-management matches snapshot", () => {
    const html = readFileSync(
      resolve(distDir, "posts/firebase-for-content-management/index.html"),
      "utf-8"
    );
    expect(normalizeHtml(html)).toMatchSnapshot();
  });

  it("post: astro-meets-firestore matches snapshot", () => {
    const html = readFileSync(
      resolve(distDir, "posts/astro-meets-firestore/index.html"),
      "utf-8"
    );
    expect(normalizeHtml(html)).toMatchSnapshot();
  });

  it("generates expected number of pages", () => {
    const postDirs = readdirSync(resolve(distDir, "posts"));
    expect(postDirs.sort()).toEqual([
      "astro-meets-firestore",
      "firebase-for-content-management",
      "getting-started-with-astro",
    ]);
  });
});
