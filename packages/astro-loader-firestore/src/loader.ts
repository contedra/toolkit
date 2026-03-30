import { readFileSync } from "node:fs";
import type { Loader, LoaderContext } from "astro/loaders";
import {
  loadModel,
  detectBodyField,
  buildSchema,
  initFirebase,
  initFirestore,
  fetchDocuments,
  transformDocumentData,
  resolveAssetUriToUrl,
  replaceAssetUris,
  replaceAssetUrisInRecord,
  downloadAsset,
  copyAssetToOutput,
  collectAssetUris,
  collectAssetUrisFromRecord,
  parseAssetUri,
} from "@contedra/core";
import type { ContedraLoaderConfig } from "./types.js";

type AstroLogger = LoaderContext["logger"];

export function contedraLoader(config: ContedraLoaderConfig): Loader {
  return {
    name: "contedra-firestore",

    async load(context) {
      const model = await loadModel(config.modelFile);
      const bodyField = detectBodyField(model, config.bodyField);
      const collectionName = config.collection ?? model.modelName;

      const firestore = initFirestore(config.firebaseConfig);
      const documents = await fetchDocuments(firestore, collectionName);

      // Transform all documents first
      const transformed = documents.map((doc) => {
        const result = transformDocumentData(doc.data, model, bodyField);
        return { id: doc.id, ...result };
      });

      // Build asset replacer if configured
      const replacer = config.assets
        ? await buildReplacer(config, transformed, context.logger)
        : undefined;

      context.store.clear();

      for (const doc of transformed) {
        let { data, body } = doc;

        if (replacer) {
          data = replaceAssetUrisInRecord(data, replacer);
          if (body) {
            body = replaceAssetUris(body, replacer);
          }
        }

        const parsed = await context.parseData({ id: doc.id, data });
        const rendered = body ? await context.renderMarkdown(body) : undefined;

        context.store.set({
          id: doc.id,
          data: parsed,
          body,
          rendered,
        });
      }
    },

    schema() {
      const raw = readFileSync(config.modelFile, "utf-8");
      const model = JSON.parse(raw);
      const bodyField = detectBodyField(model, config.bodyField);
      return buildSchema(model.properties, bodyField);
    },
  };
}

async function buildReplacer(
  config: ContedraLoaderConfig,
  documents: Array<{ data: Record<string, unknown>; body?: string }>,
  logger: AstroLogger
): Promise<(uri: string) => string> {
  const assets = config.assets!;
  const mode = assets.mode ?? "url";

  if (mode === "url") {
    const storageBucket = config.firebaseConfig.storageBucket;
    if (!storageBucket) {
      logger.warn(
        "assets.mode is 'url' but firebaseConfig.storageBucket is not set. " +
          "asset:// URIs will not be resolved."
      );
      return (uri) => uri;
    }
    return (uri) => resolveAssetUriToUrl(uri, storageBucket);
  }

  // Download mode
  const cacheDir = assets.cacheDir ?? "./.asset-cache";
  const outputDir = assets.outputDir ?? "./public/assets";
  const publicPath = (assets.publicPath ?? "/assets").replace(/\/$/, "");

  // Collect all unique asset URIs
  const allUris = new Set<string>();
  for (const doc of documents) {
    for (const uri of collectAssetUrisFromRecord(doc.data)) {
      allUris.add(uri);
    }
    if (doc.body) {
      for (const uri of collectAssetUris(doc.body)) {
        allUris.add(uri);
      }
    }
  }

  if (allUris.size === 0) {
    return (uri) => uri;
  }

  // Get Firebase app for storage access
  const app = initFirebase(config.firebaseConfig);

  // Download all assets, tracking which ones succeed
  let downloadCount = 0;
  let cachedCount = 0;
  const resolvedUris = new Set<string>();

  for (const uri of allUris) {
    const assetPath = parseAssetUri(uri);
    if (!assetPath) continue;

    try {
      const wasDownloaded = await downloadAsset(app, assetPath, cacheDir);
      copyAssetToOutput(assetPath, cacheDir, outputDir);
      resolvedUris.add(uri);
      if (wasDownloaded) {
        downloadCount++;
      } else {
        cachedCount++;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to download ${uri}: ${message}`);
    }
  }

  if (downloadCount > 0 || cachedCount > 0) {
    logger.info(
      `Assets: ${downloadCount} downloaded, ${cachedCount} from cache`
    );
  }

  return (uri) => {
    if (!resolvedUris.has(uri)) return uri;
    const assetPath = parseAssetUri(uri);
    if (!assetPath) return uri;
    return `${publicPath}/${assetPath}`;
  };
}
