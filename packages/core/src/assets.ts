import { createHash } from "node:crypto";
import { existsSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Match until common URI terminators while allowing encoded/object-name characters.
const ASSET_URI_PATTERN = /asset:\/\/[^\s"'<>()[\]{}]+/g;

/**
 * Validate that an asset path is safe for filesystem use.
 * Rejects traversal sequences, absolute paths, and null bytes.
 * Returns the normalized path, or null if unsafe.
 */
function sanitizeAssetPath(assetPath: string): string | null {
  if (!assetPath) return null;

  // Reject null bytes
  if (assetPath.includes("\0")) return null;

  // Reject absolute paths (Unix and Windows)
  if (assetPath.startsWith("/") || assetPath.startsWith("\\")) return null;
  if (/^[A-Za-z]:/.test(assetPath)) return null;

  // Reject any path containing ".." segments (before and after normalization)
  if (assetPath.split("/").includes("..")) return null;

  const normalized = path.posix.normalize(assetPath).replace(/^(\.\/)+/, "");
  if (
    normalized === "" ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return null;
  }

  return normalized;
}

/**
 * Parse an asset:// URI and return the asset path.
 * Returns null if the URI is not a valid asset:// URI or contains unsafe paths.
 */
export function parseAssetUri(uri: string): string | null {
  if (!uri.startsWith("asset://")) return null;
  const rawPath = uri.slice("asset://".length);
  // Decode percent-encoded characters to get canonical filesystem path
  let assetPath: string;
  try {
    assetPath = rawPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
  return sanitizeAssetPath(assetPath);
}

/**
 * Build a Firebase Storage public URL for a given asset path.
 * Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
 */
export function buildStorageUrl(
  assetPath: string,
  storageBucket: string
): string {
  const storagePath = `assets/${assetPath}`;
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("%2F");
  return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodedPath}?alt=media`;
}

/**
 * Convert an asset:// URI to a Firebase Storage public URL.
 * Returns the original URI if it cannot be parsed.
 */
export function resolveAssetUriToUrl(
  uri: string,
  storageBucket: string
): string {
  const assetPath = parseAssetUri(uri);
  if (!assetPath) return uri;
  return buildStorageUrl(assetPath, storageBucket);
}

/**
 * Replace all asset:// URIs in a string using the provided replacer function.
 */
export function replaceAssetUris(
  text: string,
  replacer: (uri: string) => string
): string {
  return text.replace(ASSET_URI_PATTERN, (match) => replacer(match));
}

/**
 * Walk all string values in a record and replace asset:// URIs.
 * Returns a new record with replaced values.
 */
export function replaceAssetUrisInRecord(
  data: Record<string, unknown>,
  replacer: (uri: string) => string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = replaceValue(value, replacer);
  }
  return result;
}

function replaceValue(
  value: unknown,
  replacer: (uri: string) => string
): unknown {
  if (typeof value === "string") {
    return replaceAssetUris(value, replacer);
  }
  if (Array.isArray(value)) {
    return value.map((v) => replaceValue(v, replacer));
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = replaceValue(v, replacer);
    }
    return result;
  }
  return value;
}

/**
 * Download a file from Firebase Storage to the local filesystem.
 * Returns true if the file was downloaded, false if it already existed in cache.
 */
export async function downloadAsset(
  app: App,
  assetPath: string,
  cacheDir: string
): Promise<boolean> {
  const safePath = sanitizeAssetPath(assetPath);
  if (!safePath) throw new Error(`Invalid asset path: ${assetPath}`);

  const resolvedCache = path.resolve(cacheDir);
  const cachePath = path.resolve(cacheDir, safePath);
  if (!cachePath.startsWith(resolvedCache + path.sep)) {
    throw new Error(`Asset path escapes cache directory: ${assetPath}`);
  }

  const storagePath = `assets/${safePath}`;
  const bucket = getStorage(app).bucket();
  const file = bucket.file(storagePath);

  if (existsSync(cachePath)) {
    let localMd5: string;
    try {
      localMd5 = createHash("md5")
        .update(readFileSync(cachePath))
        .digest("base64");
    } catch {
      // Corrupt or unreadable cache entry: fall through to re-download
      localMd5 = "";
    }

    if (localMd5) {
      try {
        const [metadata] = await file.getMetadata();
        if (!metadata.md5Hash || localMd5 === metadata.md5Hash) {
          return false;
        }
      } catch {
        // If metadata fetch fails, reuse cached file rather than failing the build
        return false;
      }
    }
  }

  const dir = path.dirname(cachePath);
  mkdirSync(dir, { recursive: true });

  const [contents] = await file.download();
  await writeFile(cachePath, contents);
  return true;
}

/**
 * Copy a cached asset to the output directory.
 */
export function copyAssetToOutput(
  assetPath: string,
  cacheDir: string,
  outputDir: string
): void {
  const safePath = sanitizeAssetPath(assetPath);
  if (!safePath) throw new Error(`Invalid asset path: ${assetPath}`);

  const resolvedOutput = path.resolve(outputDir);
  const dest = path.resolve(outputDir, safePath);
  if (!dest.startsWith(resolvedOutput + path.sep)) {
    throw new Error(`Asset path escapes output directory: ${assetPath}`);
  }

  const src = path.resolve(cacheDir, safePath);
  const dir = path.dirname(dest);
  mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
}

/**
 * Collect all unique asset:// URIs from a string.
 */
export function collectAssetUris(text: string): string[] {
  const matches = text.match(ASSET_URI_PATTERN);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Collect all unique asset:// URIs from a record's string values.
 */
export function collectAssetUrisFromRecord(
  data: Record<string, unknown>
): string[] {
  const uris = new Set<string>();
  for (const value of Object.values(data)) {
    collectFromValue(value, uris);
  }
  return [...uris];
}

function collectFromValue(value: unknown, uris: Set<string>): void {
  if (typeof value === "string") {
    for (const uri of collectAssetUris(value)) {
      uris.add(uri);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      collectFromValue(v, uris);
    }
  } else if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      collectFromValue(v, uris);
    }
  }
}
