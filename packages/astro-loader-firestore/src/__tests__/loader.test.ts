import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @contedra/core
vi.mock("@contedra/core", () => ({
  loadModel: vi.fn(),
  detectBodyField: vi.fn(),
  buildSchema: vi.fn(),
  initFirebase: vi.fn(() => ({ name: "contedra-test-project" })),
  initFirestore: vi.fn(),
  fetchDocuments: vi.fn(),
  transformDocumentData: vi.fn(),
  resolveAssetUriToUrl: vi.fn(),
  replaceAssetUris: vi.fn((text: string, replacer: (uri: string) => string) => {
    return text.replace(/asset:\/\/[\w.\-/]+/g, (match: string) => replacer(match));
  }),
  replaceAssetUrisInRecord: vi.fn(
    (data: Record<string, unknown>, replacer: (uri: string) => string) => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") {
          result[key] = value.replace(/asset:\/\/[\w.\-/]+/g, (match: string) =>
            replacer(match)
          );
        } else {
          result[key] = value;
        }
      }
      return result;
    }
  ),
  downloadAsset: vi.fn(),
  copyAssetToOutput: vi.fn(),
  collectAssetUris: vi.fn((text: string) => {
    const matches = text.match(/asset:\/\/[\w.\-/]+/g);
    return matches ? [...new Set(matches)] : [];
  }),
  collectAssetUrisFromRecord: vi.fn(
    (data: Record<string, unknown>) => {
      const uris: string[] = [];
      for (const value of Object.values(data)) {
        if (typeof value === "string") {
          const matches = value.match(/asset:\/\/[\w.\-/]+/g);
          if (matches) uris.push(...matches);
        }
      }
      return [...new Set(uris)];
    }
  ),
  parseAssetUri: vi.fn((uri: string) => {
    if (!uri.startsWith("asset://")) return null;
    const path = uri.slice("asset://".length);
    return path || null;
  }),
}));

// Mock node:fs for schema()
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { contedraLoader } from "../loader.js";
import {
  loadModel,
  detectBodyField,
  initFirestore,
  fetchDocuments,
  transformDocumentData,
  resolveAssetUriToUrl,
  downloadAsset,
  copyAssetToOutput,
} from "@contedra/core";
import type { ContedraLoaderConfig } from "../types.js";

const mockModel = {
  id: "blog_posts",
  modelName: "blog_posts",
  properties: [
    { propertyName: "title", dataType: "string" as const },
    {
      propertyName: "content",
      dataType: "string" as const,
      fieldType: { element: "markdown" },
    },
    { propertyName: "thumbnail", dataType: "string" as const },
  ],
};

function createMockContext() {
  return {
    store: {
      clear: vi.fn(),
      set: vi.fn(),
    },
    parseData: vi.fn(({ data }) => data),
    renderMarkdown: vi.fn((body: string) => ({
      html: `<p>${body}</p>`,
    })),
    logger: {
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
}

describe("contedraLoader with assets (url mode)", () => {
  const baseConfig: ContedraLoaderConfig = {
    modelFile: "./models/blog_posts.json",
    firebaseConfig: {
      projectId: "test-project",
      storageBucket: "test-project.firebasestorage.app",
    },
    assets: { mode: "url" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadModel).mockResolvedValue(mockModel);
    vi.mocked(detectBodyField).mockReturnValue("content");
    vi.mocked(initFirestore).mockReturnValue({} as any);
    vi.mocked(resolveAssetUriToUrl).mockImplementation(
      (uri, bucket) =>
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/assets%2F${uri.replace("asset://", "").replace(/\//g, "%2F")}?alt=media`
    );
  });

  it("should replace asset:// URIs in data fields with Storage URLs", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue([
      {
        id: "post-1",
        data: {
          title: "Hello",
          thumbnail: "asset://blog_posts/post-1/thumb.jpg",
          content: "# Post",
        },
      },
    ]);
    vi.mocked(transformDocumentData).mockReturnValue({
      data: {
        title: "Hello",
        thumbnail: "asset://blog_posts/post-1/thumb.jpg",
      },
      body: "# Post",
    });

    const loader = contedraLoader(baseConfig);
    const ctx = createMockContext();
    await loader.load(ctx as any);

    const setCall = ctx.store.set.mock.calls[0][0];
    expect(setCall.data.thumbnail).toContain("firebasestorage.googleapis.com");
    expect(setCall.data.thumbnail).not.toContain("asset://");
  });

  it("should replace asset:// URIs in body", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue([
      {
        id: "post-1",
        data: {
          title: "Hello",
          content: "![img](asset://blog_posts/post-1/photo.png)",
        },
      },
    ]);
    vi.mocked(transformDocumentData).mockReturnValue({
      data: { title: "Hello" },
      body: "![img](asset://blog_posts/post-1/photo.png)",
    });

    const loader = contedraLoader(baseConfig);
    const ctx = createMockContext();
    await loader.load(ctx as any);

    const setCall = ctx.store.set.mock.calls[0][0];
    expect(setCall.body).toContain("firebasestorage.googleapis.com");
    expect(setCall.body).not.toContain("asset://");
  });

  it("should warn when storageBucket is not set", async () => {
    const configWithoutBucket: ContedraLoaderConfig = {
      ...baseConfig,
      firebaseConfig: { projectId: "test" },
      assets: { mode: "url" },
    };

    vi.mocked(fetchDocuments).mockResolvedValue([]);

    const loader = contedraLoader(configWithoutBucket);
    const ctx = createMockContext();
    await loader.load(ctx as any);

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("storageBucket")
    );
  });
});

describe("contedraLoader with assets (download mode)", () => {
  const baseConfig: ContedraLoaderConfig = {
    modelFile: "./models/blog_posts.json",
    firebaseConfig: {
      projectId: "test-project",
      storageBucket: "test-project.firebasestorage.app",
    },
    assets: { mode: "download" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadModel).mockResolvedValue(mockModel);
    vi.mocked(detectBodyField).mockReturnValue("content");
    vi.mocked(initFirestore).mockReturnValue({} as any);
    vi.mocked(downloadAsset).mockResolvedValue(true);
    vi.mocked(copyAssetToOutput).mockReturnValue(undefined);

    // Mock getApps to return a matching app
    vi.doMock("firebase-admin/app", () => ({
      getApps: () => [{ name: "contedra-test-project" }],
    }));
  });

  it("should download assets and replace URIs with local paths", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue([
      {
        id: "post-1",
        data: {
          title: "Hello",
          thumbnail: "asset://blog_posts/post-1/thumb.jpg",
          content: "# Post",
        },
      },
    ]);
    vi.mocked(transformDocumentData).mockReturnValue({
      data: {
        title: "Hello",
        thumbnail: "asset://blog_posts/post-1/thumb.jpg",
      },
      body: "# Post with ![img](asset://blog_posts/post-1/photo.png)",
    });

    const loader = contedraLoader(baseConfig);
    const ctx = createMockContext();
    await loader.load(ctx as any);

    const setCall = ctx.store.set.mock.calls[0][0];
    expect(setCall.data.thumbnail).toBe(
      "/assets/blog_posts/post-1/thumb.jpg"
    );
    expect(setCall.body).toContain("/assets/blog_posts/post-1/photo.png");
    expect(setCall.body).not.toContain("asset://");
  });

  it("should use custom outputDir and publicPath", async () => {
    const customConfig: ContedraLoaderConfig = {
      ...baseConfig,
      assets: {
        mode: "download",
        outputDir: "./public/images",
        publicPath: "/images",
        cacheDir: "./.cache",
      },
    };

    vi.mocked(fetchDocuments).mockResolvedValue([
      {
        id: "post-1",
        data: {
          title: "Hello",
          thumbnail: "asset://blog_posts/post-1/thumb.jpg",
          content: "Body",
        },
      },
    ]);
    vi.mocked(transformDocumentData).mockReturnValue({
      data: {
        title: "Hello",
        thumbnail: "asset://blog_posts/post-1/thumb.jpg",
      },
      body: "Body",
    });

    const loader = contedraLoader(customConfig);
    const ctx = createMockContext();
    await loader.load(ctx as any);

    const setCall = ctx.store.set.mock.calls[0][0];
    expect(setCall.data.thumbnail).toBe(
      "/images/blog_posts/post-1/thumb.jpg"
    );
  });
});

describe("contedraLoader without assets option", () => {
  const baseConfig: ContedraLoaderConfig = {
    modelFile: "./models/blog_posts.json",
    firebaseConfig: { projectId: "test-project" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadModel).mockResolvedValue(mockModel);
    vi.mocked(detectBodyField).mockReturnValue("content");
    vi.mocked(initFirestore).mockReturnValue({} as any);
  });

  it("should not modify asset:// URIs when assets option is not set", async () => {
    vi.mocked(fetchDocuments).mockResolvedValue([
      {
        id: "post-1",
        data: {
          title: "Hello",
          thumbnail: "asset://blog_posts/post-1/thumb.jpg",
          content: "# Post",
        },
      },
    ]);
    vi.mocked(transformDocumentData).mockReturnValue({
      data: {
        title: "Hello",
        thumbnail: "asset://blog_posts/post-1/thumb.jpg",
      },
      body: "# Post",
    });

    const loader = contedraLoader(baseConfig);
    const ctx = createMockContext();
    await loader.load(ctx as any);

    const setCall = ctx.store.set.mock.calls[0][0];
    expect(setCall.data.thumbnail).toBe(
      "asset://blog_posts/post-1/thumb.jpg"
    );
  });
});
