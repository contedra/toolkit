import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { downloadAsset } from "../assets.js";

// Mock firebase-admin/storage
const mockDownload = vi.fn();
const mockGetMetadata = vi.fn();
const mockFile = vi.fn(() => ({
  download: mockDownload,
  getMetadata: mockGetMetadata,
}));
const mockBucket = vi.fn(() => ({ file: mockFile }));

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: mockBucket }),
}));

const fakeApp = {} as import("firebase-admin/app").App;

function md5Base64(content: Buffer): string {
  return createHash("md5").update(content).digest("base64");
}

describe("downloadAsset (md5 cache verification)", () => {
  let tmpDir: string;
  let cacheDir: string;

  beforeEach(() => {
    tmpDir = path.join(
      os.tmpdir(),
      `contedra-md5-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    cacheDir = path.join(tmpDir, "cache");
    mkdirSync(cacheDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should download files not in cache", async () => {
    const content = Buffer.from("new-file-content");
    mockDownload.mockResolvedValue([content]);

    const result = await downloadAsset(fakeApp, "model/doc/image.png", cacheDir);

    expect(result).toBe(true);
    expect(mockDownload).toHaveBeenCalledOnce();
    const cached = readFileSync(path.join(cacheDir, "model/doc/image.png"));
    expect(cached).toEqual(content);
  });

  it("should skip re-download when cached file md5 matches remote", async () => {
    const content = Buffer.from("cached-content");
    const cachedPath = path.join(cacheDir, "model/doc/image.png");
    mkdirSync(path.dirname(cachedPath), { recursive: true });
    writeFileSync(cachedPath, content);

    mockGetMetadata.mockResolvedValue([{ md5Hash: md5Base64(content) }]);

    const result = await downloadAsset(fakeApp, "model/doc/image.png", cacheDir);

    expect(result).toBe(false);
    expect(mockGetMetadata).toHaveBeenCalledOnce();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("should re-download when cached file md5 differs from remote", async () => {
    const oldContent = Buffer.from("old-content");
    const newContent = Buffer.from("new-content");
    const cachedPath = path.join(cacheDir, "model/doc/image.png");
    mkdirSync(path.dirname(cachedPath), { recursive: true });
    writeFileSync(cachedPath, oldContent);

    // Remote has a different md5
    mockGetMetadata.mockResolvedValue([{ md5Hash: md5Base64(newContent) }]);
    mockDownload.mockResolvedValue([newContent]);

    const result = await downloadAsset(fakeApp, "model/doc/image.png", cacheDir);

    expect(result).toBe(true);
    expect(mockDownload).toHaveBeenCalledOnce();
    const cached = readFileSync(cachedPath);
    expect(cached).toEqual(newContent);
  });

  it("should reuse cached file when metadata has no md5Hash", async () => {
    const content = Buffer.from("cached-content");
    const cachedPath = path.join(cacheDir, "model/doc/image.png");
    mkdirSync(path.dirname(cachedPath), { recursive: true });
    writeFileSync(cachedPath, content);

    mockGetMetadata.mockResolvedValue([{ md5Hash: undefined }]);

    const result = await downloadAsset(fakeApp, "model/doc/image.png", cacheDir);

    expect(result).toBe(false);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("should reuse cached file when getMetadata fails", async () => {
    const content = Buffer.from("cached-content");
    const cachedPath = path.join(cacheDir, "model/doc/image.png");
    mkdirSync(path.dirname(cachedPath), { recursive: true });
    writeFileSync(cachedPath, content);

    mockGetMetadata.mockRejectedValue(new Error("Network error"));

    const result = await downloadAsset(fakeApp, "model/doc/image.png", cacheDir);

    expect(result).toBe(false);
    expect(mockDownload).not.toHaveBeenCalled();
    // Cached file should remain unchanged
    expect(readFileSync(cachedPath)).toEqual(content);
  });

  it("should re-download when cached file is unreadable", async () => {
    // Create a directory where a file is expected, making readFileSync fail
    const cachedPath = path.join(cacheDir, "model/doc/image.png");
    mkdirSync(cachedPath, { recursive: true });

    const newContent = Buffer.from("fresh-download");
    mockDownload.mockResolvedValue([newContent]);

    // readFileSync throws EISDIR, localMd5 becomes empty, falls through to download.
    // writeFile also throws EISDIR since cachePath is a directory,
    // so the function propagates the error (expected for truly broken cache entries).
    await expect(
      downloadAsset(fakeApp, "model/doc/image.png", cacheDir)
    ).rejects.toThrow();
    expect(mockDownload).toHaveBeenCalledOnce();
  });

  it("should not create additional metadata files in cache directory", async () => {
    const content = Buffer.from("file-content");
    mockDownload.mockResolvedValue([content]);

    await downloadAsset(fakeApp, "model/doc/image.png", cacheDir);

    const dir = path.join(cacheDir, "model/doc");
    const files = readdirSync(dir);
    expect(files).toEqual(["image.png"]);
  });
});
