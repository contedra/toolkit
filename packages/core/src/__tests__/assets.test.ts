import { describe, it, expect } from "vitest";
import {
  parseAssetUri,
  buildStorageUrl,
  resolveAssetUriToUrl,
  replaceAssetUris,
  replaceAssetUrisInRecord,
  collectAssetUris,
  collectAssetUrisFromRecord,
} from "../assets.js";

describe("parseAssetUri", () => {
  it("should parse a valid asset:// URI", () => {
    expect(parseAssetUri("asset://blog_posts/post-1/image.png")).toBe(
      "blog_posts/post-1/image.png"
    );
  });

  it("should return null for non-asset URIs", () => {
    expect(parseAssetUri("https://example.com")).toBeNull();
    expect(parseAssetUri("")).toBeNull();
    expect(parseAssetUri("asset://")).toBeNull();
  });

  it("should reject directory traversal sequences", () => {
    expect(parseAssetUri("asset://../../etc/passwd")).toBeNull();
    expect(parseAssetUri("asset://posts/../../../secret")).toBeNull();
    expect(parseAssetUri("asset://..")).toBeNull();
  });

  it("should reject absolute paths", () => {
    expect(parseAssetUri("asset:///etc/passwd")).toBeNull();
    expect(parseAssetUri("asset://\\windows\\system32")).toBeNull();
    expect(parseAssetUri("asset://C:/windows/file")).toBeNull();
  });

  it("should reject null bytes", () => {
    expect(parseAssetUri("asset://posts/file\0.png")).toBeNull();
  });

  it("should normalize safe paths with dot segments", () => {
    expect(parseAssetUri("asset://posts/./file.png")).toBe("posts/file.png");
  });

  it("should decode percent-encoded characters", () => {
    expect(parseAssetUri("asset://posts/p1/my%20image.png")).toBe(
      "posts/p1/my image.png"
    );
    expect(parseAssetUri("asset://posts/p1/%E6%97%A5%E6%9C%AC%E8%AA%9E.png")).toBe(
      "posts/p1/\u65E5\u672C\u8A9E.png"
    );
  });

  it("should reject percent-encoded traversal", () => {
    expect(parseAssetUri("asset://posts/%2e%2e/secret")).toBeNull();
  });
});

describe("buildStorageUrl", () => {
  it("should build a Firebase Storage public URL", () => {
    const url = buildStorageUrl(
      "blog_posts/post-1/image.png",
      "my-project.firebasestorage.app"
    );
    expect(url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/my-project.firebasestorage.app/o/assets%2Fblog_posts%2Fpost-1%2Fimage.png?alt=media"
    );
  });

  it("should encode special characters in file names", () => {
    const url = buildStorageUrl(
      "posts/doc-1/my image (1).png",
      "bucket.appspot.com"
    );
    expect(url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/assets%2Fposts%2Fdoc-1%2Fmy%20image%20(1).png?alt=media"
    );
  });
});

describe("resolveAssetUriToUrl", () => {
  it("should convert asset:// URI to Storage URL", () => {
    const url = resolveAssetUriToUrl(
      "asset://blog_posts/post-1/hero.jpg",
      "my-project.firebasestorage.app"
    );
    expect(url).toContain("firebasestorage.googleapis.com");
    expect(url).toContain("assets%2Fblog_posts%2Fpost-1%2Fhero.jpg");
    expect(url).toContain("alt=media");
  });

  it("should return original URI if not an asset:// URI", () => {
    expect(
      resolveAssetUriToUrl("https://example.com", "bucket")
    ).toBe("https://example.com");
  });
});

describe("replaceAssetUris", () => {
  it("should replace asset:// URIs in text", () => {
    const text = "Look at ![photo](asset://posts/p1/img.png) here";
    const result = replaceAssetUris(text, (uri) => uri.replace("asset://", "/assets/"));
    expect(result).toBe("Look at ![photo](/assets/posts/p1/img.png) here");
  });

  it("should replace multiple URIs", () => {
    const text = "asset://a/b/1.png and asset://a/b/2.png";
    const result = replaceAssetUris(text, () => "REPLACED");
    expect(result).toBe("REPLACED and REPLACED");
  });

  it("should not modify text without asset:// URIs", () => {
    const text = "No assets here https://example.com/image.png";
    const result = replaceAssetUris(text, () => "REPLACED");
    expect(result).toBe(text);
  });
});

describe("replaceAssetUrisInRecord", () => {
  it("should replace asset:// URIs in string values", () => {
    const data = {
      title: "Hello",
      thumbnail: "asset://posts/p1/thumb.jpg",
      count: 42,
    };
    const result = replaceAssetUrisInRecord(data, (uri) =>
      uri.replace("asset://", "/assets/")
    );
    expect(result.title).toBe("Hello");
    expect(result.thumbnail).toBe("/assets/posts/p1/thumb.jpg");
    expect(result.count).toBe(42);
  });

  it("should replace URIs in arrays of strings", () => {
    const data = {
      images: ["asset://m/c/a.png", "asset://m/c/b.png"],
    };
    const result = replaceAssetUrisInRecord(data, (uri) =>
      uri.replace("asset://", "/assets/")
    );
    expect(result.images).toEqual(["/assets/m/c/a.png", "/assets/m/c/b.png"]);
  });

  it("should replace URIs in nested objects", () => {
    const data = {
      metadata: { imageUrl: "asset://m/c/thumb.jpg", count: 5 },
    };
    const result = replaceAssetUrisInRecord(data, (uri) =>
      uri.replace("asset://", "/assets/")
    );
    expect((result.metadata as Record<string, unknown>).imageUrl).toBe(
      "/assets/m/c/thumb.jpg"
    );
    expect((result.metadata as Record<string, unknown>).count).toBe(5);
  });

  it("should not modify non-string values", () => {
    const date = new Date();
    const data = { published: date, count: 5, active: true };
    const result = replaceAssetUrisInRecord(data, () => "X");
    expect(result.published).toBe(date);
    expect(result.count).toBe(5);
    expect(result.active).toBe(true);
  });
});

describe("collectAssetUris", () => {
  it("should collect all unique URIs from text", () => {
    const text =
      "![a](asset://m/c/1.png) text ![b](asset://m/c/2.png) and asset://m/c/1.png again";
    const uris = collectAssetUris(text);
    expect(uris).toEqual(["asset://m/c/1.png", "asset://m/c/2.png"]);
  });

  it("should return empty array for text without asset URIs", () => {
    expect(collectAssetUris("no assets here")).toEqual([]);
  });

  it("should match URIs with percent-encoded characters", () => {
    const text = "![img](asset://posts/p1/my%20image.png)";
    const uris = collectAssetUris(text);
    expect(uris).toEqual(["asset://posts/p1/my%20image.png"]);
  });
});

describe("collectAssetUrisFromRecord", () => {
  it("should collect URIs from all string fields", () => {
    const data = {
      title: "Hello",
      thumbnail: "asset://m/c/thumb.jpg",
      gallery: ["asset://m/c/a.png", "asset://m/c/b.png"],
      count: 42,
    };
    const uris = collectAssetUrisFromRecord(data);
    expect(uris).toHaveLength(3);
    expect(uris).toContain("asset://m/c/thumb.jpg");
    expect(uris).toContain("asset://m/c/a.png");
    expect(uris).toContain("asset://m/c/b.png");
  });

  it("should collect URIs from nested objects", () => {
    const data = {
      metadata: { imageUrl: "asset://m/c/nested.jpg" },
    };
    const uris = collectAssetUrisFromRecord(data);
    expect(uris).toEqual(["asset://m/c/nested.jpg"]);
  });
});
