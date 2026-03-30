import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const ASSET_URI_PATTERN = /asset:\/\/[\w.\-/]+/g;

/**
 * Parse an asset:// URI and return the asset path.
 * Returns null if the URI is not a valid asset:// URI.
 */
export function parseAssetUri(uri: string): string | null {
  if (!uri.startsWith("asset://")) return null;
  const assetPath = uri.slice("asset://".length);
  if (!assetPath) return null;
  return assetPath;
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
  const cachePath = path.join(cacheDir, assetPath);

  if (existsSync(cachePath)) {
    return false;
  }

  const dir = path.dirname(cachePath);
  mkdirSync(dir, { recursive: true });

  const storagePath = `assets/${assetPath}`;
  const bucket = getStorage(app).bucket();
  const file = bucket.file(storagePath);

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
  const src = path.join(cacheDir, assetPath);
  const dest = path.join(outputDir, assetPath);
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
  }
}
