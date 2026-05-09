import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ModelDefinition } from "@contedra/core";

/** Regex matching Markdown image syntax: ![alt](path) or ![alt](path "title") */
const IMAGE_REGEX = /!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)/g;

/**
 * Compute the set of frontmatter field names whose values should be uploaded
 * as image assets. Two sources merge:
 *   1. asset dataType properties with mediaType "image" (auto-recognized)
 *   2. explicit `imageFields` (legacy/backward-compat for string-typed fields)
 *
 * Other mediaType values (when added: video / audio / file) are intentionally
 * skipped here — they need their own resolver branch in importer.ts.
 */
export function resolveImageFieldNames(
  model: ModelDefinition,
  imageFields?: string[]
): Set<string> {
  const names = new Set<string>();
  for (const prop of model.properties) {
    if (prop.dataType === "asset" && prop.mediaType === "image") {
      names.add(prop.propertyName);
    }
  }
  if (imageFields?.length) {
    for (const f of imageFields) names.add(f);
  }
  return names;
}

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
 * For absolute paths (starting with "/"), resolves against imageBaseDir if provided.
 */
export async function defaultResolveImage(
  imagePath: string,
  mdFilePath: string,
  imageBaseDir?: string
): Promise<Buffer> {
  if (path.isAbsolute(imagePath)) {
    if (!imageBaseDir) {
      throw new Error(
        `Absolute image path requires imageBaseDir: ${imagePath}`
      );
    }

    const base = path.resolve(imageBaseDir);
    const resolved = path.resolve(base, imagePath.slice(1));
    const rel = path.relative(base, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Image path escapes base directory: ${imagePath}`);
    }
    return readFile(resolved);
  }
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
