import type { FirebaseConfig } from "@contedra/core";

export interface MdImporterConfig {
  /** Directory containing .md files to import */
  mdDir: string;
  /** Path to model definition JSON file (single ModelDefinition or ModelManifest) */
  modelFile: string;
  /** Required when `modelFile` is a ModelManifest containing multiple models */
  modelName?: string;
  /** Firebase configuration */
  firebaseConfig: FirebaseConfig;
  /** Firestore collection name (defaults to model's modelName) */
  collection?: string;
  /** Mapping from frontmatter keys to model property names */
  fieldMapping?: Record<string, string>;
  /** Directory for resolving absolute image paths (e.g. "./public") */
  imageBaseDir?: string;
  /** Frontmatter field names that contain image paths (uploaded and converted to asset:// URIs) */
  imageFields?: string[];
  /** Skip all image extraction, upload, and URL replacement */
  noImages?: boolean;
  /** Custom image resolver. Default: reads relative to the .md file */
  resolveImage?: (imagePath: string, mdFilePath: string) => Promise<Buffer>;
}

export interface ImportedDocument {
  docId: string;
  filePath: string;
}

export interface ImportResult {
  imported: ImportedDocument[];
  errors: Array<{ filePath: string; error: string }>;
}
