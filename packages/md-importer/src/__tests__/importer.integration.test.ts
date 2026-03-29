import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { initFirestore } from "@contedra/core";
import { mdImporter } from "../importer.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures");
const PROJECT_ID = "demo-md-importer";
const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`;

/**
 * Integration tests require the Firestore emulator.
 * Set FIRESTORE_EMULATOR_HOST=localhost:8080 before running.
 */
describe("mdImporter integration", () => {
  let tmpDir: string;

  beforeAll(async () => {
    if (!process.env["FIRESTORE_EMULATOR_HOST"]) {
      process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
    }

    // Create a temp directory with md files and images
    tmpDir = path.join(import.meta.dirname, "fixtures", "_tmp_integration");
    await mkdir(tmpDir, { recursive: true });
    await mkdir(path.join(tmpDir, "images"), { recursive: true });

    await writeFile(
      path.join(tmpDir, "hello-world.md"),
      `---
title: Hello World
publishedAt: 2024-01-15
tags:
  - tag-1
---

First post content.

![hero](./images/hero.png)
`
    );

    await writeFile(
      path.join(tmpDir, "second-post.md"),
      `---
title: Second Post
publishedAt: 2024-02-01
---

Second post body.
`
    );

    // Write a fake image
    await writeFile(
      path.join(tmpDir, "images", "hero.png"),
      Buffer.from("fake-png-bytes")
    );
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("imports markdown files into Firestore", async () => {
    const result = await mdImporter({
      mdDir: tmpDir,
      modelFile: path.join(FIXTURES, "blog_posts.json"),
      firebaseConfig: { projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET },
    });

    expect(result.errors).toEqual([]);
    expect(result.imported).toHaveLength(2);
    expect(result.imported.map((d) => d.docId).sort()).toEqual([
      "hello-world",
      "second-post",
    ]);

    // Verify documents in Firestore
    const firestore = initFirestore({ projectId: PROJECT_ID });

    const helloDoc = await firestore
      .collection("blog_posts")
      .doc("hello-world")
      .get();
    expect(helloDoc.exists).toBe(true);

    const helloData = helloDoc.data()!;
    expect(helloData["title"]).toBe("Hello World");
    expect(helloData["tags"]).toEqual(["tag-1"]);

    // Verify the body field (content) contains the asset:// replacement
    const content = helloData["content"] as string;
    expect(content).toContain("First post content.");
    expect(content).toContain("asset://blog_posts/hello-world/hero.png");
    expect(content).not.toContain("./images/hero.png");

    // Verify second post
    const secondDoc = await firestore
      .collection("blog_posts")
      .doc("second-post")
      .get();
    expect(secondDoc.exists).toBe(true);
    expect(secondDoc.data()!["title"]).toBe("Second Post");
  });

  it("uses custom collection name", async () => {
    const result = await mdImporter({
      mdDir: tmpDir,
      modelFile: path.join(FIXTURES, "blog_posts.json"),
      firebaseConfig: { projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET },
      collection: "custom_collection",
    });

    expect(result.errors).toEqual([]);

    const firestore = initFirestore({ projectId: PROJECT_ID });
    const doc = await firestore
      .collection("custom_collection")
      .doc("hello-world")
      .get();
    expect(doc.exists).toBe(true);
  });

  it("applies field mapping", async () => {
    // Create a temp file with different field names
    const mappedDir = path.join(tmpDir, "_mapped");
    await mkdir(mappedDir, { recursive: true });
    await writeFile(
      path.join(mappedDir, "mapped-post.md"),
      `---
headline: Mapped Title
pubDate: 2024-03-01
---

Mapped content.
`
    );

    const result = await mdImporter({
      mdDir: mappedDir,
      modelFile: path.join(FIXTURES, "blog_posts.json"),
      firebaseConfig: { projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET },
      collection: "mapped_posts",
      fieldMapping: {
        headline: "title",
        pubDate: "publishedAt",
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.imported).toHaveLength(1);

    const firestore = initFirestore({ projectId: PROJECT_ID });
    const doc = await firestore
      .collection("mapped_posts")
      .doc("mapped-post")
      .get();
    expect(doc.exists).toBe(true);
    expect(doc.data()!["title"]).toBe("Mapped Title");

    await rm(mappedDir, { recursive: true, force: true });
  });

  it("uses custom resolveImage callback", async () => {
    const customDir = path.join(tmpDir, "_custom_resolve");
    await mkdir(customDir, { recursive: true });
    await writeFile(
      path.join(customDir, "custom.md"),
      `---
title: Custom Resolve
---

![photo](special/photo.png)
`
    );

    const customImageData = Buffer.from("custom-resolved-image");

    const result = await mdImporter({
      mdDir: customDir,
      modelFile: path.join(FIXTURES, "blog_posts.json"),
      firebaseConfig: { projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET },
      collection: "custom_resolve_posts",
      resolveImage: async (_imagePath, _mdFilePath) => {
        return customImageData;
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.imported).toHaveLength(1);

    const firestore = initFirestore({ projectId: PROJECT_ID });
    const doc = await firestore
      .collection("custom_resolve_posts")
      .doc("custom")
      .get();
    const content = doc.data()!["content"] as string;
    expect(content).toContain("asset://blog_posts/custom/photo.png");

    await rm(customDir, { recursive: true, force: true });
  });

  it("resolves absolute image paths with imageBaseDir", async () => {
    // Create content dir with md referencing absolute image path
    const absDir = path.join(tmpDir, "_abs_images");
    await mkdir(absDir, { recursive: true });
    await writeFile(
      path.join(absDir, "abs-post.md"),
      `---
title: Absolute Image Post
---

![banner](/images/test.png)
`
    );

    // Create a public directory with the image
    const imageBaseDir = path.join(tmpDir, "_public");
    await mkdir(path.join(imageBaseDir, "images"), { recursive: true });
    await writeFile(
      path.join(imageBaseDir, "images", "test.png"),
      Buffer.from("fake-absolute-image-bytes")
    );

    const result = await mdImporter({
      mdDir: absDir,
      modelFile: path.join(FIXTURES, "blog_posts.json"),
      firebaseConfig: { projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET },
      collection: "abs_image_posts",
      imageBaseDir,
    });

    expect(result.errors).toEqual([]);
    expect(result.imported).toHaveLength(1);

    // Verify the body has asset:// URI replacement
    const firestore = initFirestore({ projectId: PROJECT_ID });
    const doc = await firestore
      .collection("abs_image_posts")
      .doc("abs-post")
      .get();
    expect(doc.exists).toBe(true);

    const content = doc.data()!["content"] as string;
    expect(content).toContain("asset://blog_posts/abs-post/test.png");
    expect(content).not.toContain("/images/test.png");

    await rm(absDir, { recursive: true, force: true });
    await rm(imageBaseDir, { recursive: true, force: true });
  });
});
