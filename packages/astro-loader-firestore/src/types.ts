import type { FirebaseConfig } from "@contedra/core";

export interface AssetOptions {
  /** Resolution mode: "url" converts to public URLs, "download" fetches files locally */
  mode?: "download" | "url";
  /** Directory to save downloaded assets (default: "./.asset-cache/{collection}") */
  cacheDir?: string;
  /** Directory to copy assets for serving (default: "./public/assets/{collection}") */
  outputDir?: string;
  /** URL path prefix for resolved assets (default: "/assets/{collection}") */
  publicPath?: string;
}

export interface ContedraLoaderConfig {
  /** Path to the Conteditor model JSON file */
  modelFile: string;
  /** Field name to map to Astro's body (auto-detects element:"markdown" if omitted) */
  bodyField?: string;
  /** Firebase configuration */
  firebaseConfig: FirebaseConfig;
  /** Firestore collection name (defaults to modelName) */
  collection?: string;
  /** Asset resolution options for asset:// URIs */
  assets?: AssetOptions;
}
