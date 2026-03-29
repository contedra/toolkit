import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadModel, detectBodyField, initFirestore } from "@contedra/core";
import { getStorage } from "firebase-admin/storage";
import { getApps } from "firebase-admin/app";
import slugify from "slugify";

import type { MdImporterConfig, ImportResult } from "./types.js";
import { parseMarkdownFile } from "./parser.js";
import { mapFields } from "./mapper.js";
import {
  extractImageRefs,
  defaultResolveImage,
  assetStoragePath,
  assetUri,
  replaceImageRefs,
} from "./images.js";

/**
 * Generate a document ID from a filename.
 * Uses the filename stem, slugified for safe Firestore doc IDs.
 */
export function generateDocId(filePath: string): string {
  const stem = path.basename(filePath, path.extname(filePath));
  return slugify(stem, { lower: true, strict: true });
}

/**
 * Import Markdown files into Firestore using a model definition.
 */
export async function mdImporter(
  config: MdImporterConfig
): Promise<ImportResult> {
  const model = await loadModel(config.modelFile);
  const bodyField = detectBodyField(model);
  const collectionName = config.collection ?? model.modelName;
  const resolveImage = config.resolveImage ?? defaultResolveImage;

  const firestore = initFirestore(config.firebaseConfig);
  const appName = `contedra-${config.firebaseConfig.projectId}`;
  const app = getApps().find((a) => a.name === appName)!;
  const bucket = getStorage(app).bucket();

  const mdFiles = await findMarkdownFiles(config.mdDir);

  const result: ImportResult = { imported: [], errors: [] };

  for (const mdFile of mdFiles) {
    try {
      const absolutePath = path.resolve(config.mdDir, mdFile);
      const docId = generateDocId(mdFile);

      const { frontmatter, body } = await parseMarkdownFile(absolutePath);
      const { data } = mapFields(frontmatter, model, config.fieldMapping);

      let processedBody = body;

      // Process images
      if (bodyField && body) {
        const imageRefs = extractImageRefs(body);
        const replacements = new Map<string, string>();

        for (const ref of imageRefs) {
          const fileName = path.basename(ref.originalPath);
          const storagePath = assetStoragePath(
            model.modelName,
            docId,
            fileName
          );

          const imageBuffer = await resolveImage(
            ref.originalPath,
            absolutePath
          );

          const file = bucket.file(storagePath);
          await file.save(imageBuffer);

          const uri = assetUri(model.modelName, docId, fileName);
          replacements.set(
            ref.fullMatch,
            `![${ref.alt}](${uri})`
          );
        }

        processedBody = replaceImageRefs(body, replacements);
      }

      // Build the Firestore document
      const docData: Record<string, unknown> = { ...data };
      if (bodyField) {
        docData[bodyField] = processedBody;
      }

      // Convert Date objects to Firestore Timestamps
      const { Timestamp } = await import("firebase-admin/firestore");
      for (const [key, value] of Object.entries(docData)) {
        if (value instanceof Date) {
          docData[key] = Timestamp.fromDate(value);
        }
      }

      await firestore.collection(collectionName).doc(docId).set(docData);

      result.imported.push({ docId, filePath: mdFile });
    } catch (err) {
      result.errors.push({
        filePath: mdFile,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const mdFiles: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      mdFiles.push(entry.name);
    }
  }
  return mdFiles.sort();
}
