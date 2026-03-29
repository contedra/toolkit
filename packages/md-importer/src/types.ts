import type { FirebaseConfig } from "@contedra/core";

export interface MdImporterConfig {
  /** Directory containing .md files to import */
  mdDir: string;
  /** Path to model definition JSON file */
  modelFile: string;
  /** Firebase configuration */
  firebaseConfig: FirebaseConfig;
  /** Firestore collection name (defaults to model's modelName) */
  collection?: string;
  /** Mapping from frontmatter keys to model property names */
  fieldMapping?: Record<string, string>;
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
