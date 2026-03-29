import { readFile } from "node:fs/promises";
import path from "node:path";

/** Regex matching Markdown image syntax: ![alt](path) */
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

export interface ImageRef {
  /** Full match string in the Markdown */
  fullMatch: string;
  /** Alt text */
  alt: string;
  /** Original image path from Markdown */
  originalPath: string;
}

/**
 * Extract all image references from Markdown content.
 * Skips URLs (http:// or https://) and asset:// references.
 */
export function extractImageRefs(body: string): ImageRef[] {
  const refs: ImageRef[] = [];
  for (const match of body.matchAll(IMAGE_REGEX)) {
    const imgPath = match[2];
    if (
      imgPath.startsWith("http://") ||
      imgPath.startsWith("https://") ||
      imgPath.startsWith("asset://")
    ) {
      continue;
    }
    refs.push({
      fullMatch: match[0],
      alt: match[1],
      originalPath: imgPath,
    });
  }
  return refs;
}

/**
 * Default image resolver: reads file relative to the Markdown file's directory.
 */
export async function defaultResolveImage(
  imagePath: string,
  mdFilePath: string
): Promise<Buffer> {
  const dir = path.dirname(mdFilePath);
  const resolved = path.resolve(dir, imagePath);
  return readFile(resolved);
}

/**
 * Generate a Storage path for an asset using v2 format.
 * Format: assets/{modelName}/{contentId}/{fileId}
 */
export function assetStoragePath(
  modelName: string,
  contentId: string,
  fileName: string
): string {
  return `assets/${modelName}/${contentId}/${fileName}`;
}

/**
 * Generate an asset:// URI using v2 format.
 * Format: asset://{modelName}/{contentId}/{fileId}
 */
export function assetUri(
  modelName: string,
  contentId: string,
  fileName: string
): string {
  return `asset://${modelName}/${contentId}/${fileName}`;
}

/**
 * Replace image references in Markdown body with asset:// URIs.
 */
export function replaceImageRefs(
  body: string,
  replacements: Map<string, string>
): string {
  let result = body;
  for (const [fullMatch, assetUriStr] of replacements) {
    result = result.replace(fullMatch, assetUriStr);
  }
  return result;
}
