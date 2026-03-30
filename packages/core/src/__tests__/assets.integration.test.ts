import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { downloadAsset, copyAssetToOutput } from "../assets.js";

// firebase emulators:exec sets FIREBASE_STORAGE_EMULATOR_HOST automatically
const STORAGE_EMULATOR_HOST =
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "localhost:9299";
const PROJECT_ID = "core-asset-integration-test";
const BUCKET_NAME = `${PROJECT_ID}.firebasestorage.app`;

// Minimal valid PNG (1x1 pixel, transparent)
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

let app: App;

beforeAll(async () => {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE_EMULATOR_HOST;

  app = initializeApp(
    {
      projectId: PROJECT_ID,
      storageBucket: BUCKET_NAME,
    },
    `integration-${PROJECT_ID}`
  );

  // Upload test files to emulator
  const bucket = getStorage(app).bucket();
  await bucket.file("assets/test-model/doc-1/sample.png").save(TEST_PNG, {
    contentType: "image/png",
  });
  await bucket.file("assets/test-model/doc-1/photo.jpg").save(
    Buffer.from("fake-jpg-content"),
    { contentType: "image/jpeg" }
  );
});

afterAll(async () => {
  if (app) {
    await deleteApp(app);
  }
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
});

describe("downloadAsset (integration)", () => {
  let tmpDir: string;
  let cacheDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `contedra-dl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = path.join(tmpDir, "cache");
    mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should download a file from Storage emulator to cacheDir", async () => {
    const wasDownloaded = await downloadAsset(
      app,
      "test-model/doc-1/sample.png",
      cacheDir
    );

    expect(wasDownloaded).toBe(true);

    const cachedPath = path.join(cacheDir, "test-model/doc-1/sample.png");
    expect(existsSync(cachedPath)).toBe(true);

    const content = readFileSync(cachedPath);
    expect(content).toEqual(TEST_PNG);
  });

  it("should return false for cached files (skip re-download)", async () => {
    // First download to populate cache
    await downloadAsset(app, "test-model/doc-1/sample.png", cacheDir);

    // Second call should return false (cache hit)
    const wasDownloaded = await downloadAsset(
      app,
      "test-model/doc-1/sample.png",
      cacheDir
    );

    expect(wasDownloaded).toBe(false);
  });

  it("should download different files independently", async () => {
    const wasDownloaded = await downloadAsset(
      app,
      "test-model/doc-1/photo.jpg",
      cacheDir
    );

    expect(wasDownloaded).toBe(true);

    const cachedPath = path.join(cacheDir, "test-model/doc-1/photo.jpg");
    expect(existsSync(cachedPath)).toBe(true);

    const content = readFileSync(cachedPath);
    expect(content.toString()).toBe("fake-jpg-content");
  });

  it("should throw for non-existent storage path", async () => {
    await expect(
      downloadAsset(app, "nonexistent/path/file.png", cacheDir)
    ).rejects.toThrow();
  });
});

describe("copyAssetToOutput (integration)", () => {
  let tmpDir: string;
  let cacheDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `contedra-cp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = path.join(tmpDir, "cache");
    outputDir = path.join(tmpDir, "output");
    mkdirSync(cacheDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should copy cached file to outputDir with correct content", async () => {
    // Download first to populate cache
    await downloadAsset(app, "test-model/doc-1/sample.png", cacheDir);

    copyAssetToOutput("test-model/doc-1/sample.png", cacheDir, outputDir);

    const outputPath = path.join(outputDir, "test-model/doc-1/sample.png");
    expect(existsSync(outputPath)).toBe(true);

    const content = readFileSync(outputPath);
    expect(content).toEqual(TEST_PNG);
  });

  it("should create nested directories in outputDir", async () => {
    await downloadAsset(app, "test-model/doc-1/photo.jpg", cacheDir);

    // Use a fresh nested outputDir to verify directory creation
    const nestedOutputDir = path.join(tmpDir, "fresh-output");
    copyAssetToOutput("test-model/doc-1/photo.jpg", cacheDir, nestedOutputDir);

    const outputPath = path.join(nestedOutputDir, "test-model/doc-1/photo.jpg");
    expect(existsSync(outputPath)).toBe(true);
  });
});
