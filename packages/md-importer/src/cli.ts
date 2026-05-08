#!/usr/bin/env node
import { Command } from "commander";
import { mdImporter } from "./importer.js";

const program = new Command();

program
  .name("md-importer")
  .description(
    "Import YAML-frontmatter Markdown files + images into Firestore"
  )
  .requiredOption("--md-dir <path>", "Directory containing .md files")
  .requiredOption("--model <path>", "Path to model definition JSON")
  .requiredOption("--project-id <id>", "Firebase project ID")
  .option("--credential <path>", "Path to service account JSON")
  .option(
    "--model-name <name>",
    "Model name to select from a ModelManifest (required when the file contains multiple models)"
  )
  .option("--collection <name>", "Firestore collection name (defaults to modelName)")
  .option("--storage-bucket <name>", "Firebase Storage bucket name (e.g. your-project.firebasestorage.app)")
  .option("--no-images", "Skip image extraction, upload, and URL replacement")
  .option("--image-base-dir <path>", "Directory for resolving absolute image paths (e.g. ./public)")
  .option("--image-fields <fields>", "Comma-separated frontmatter field names that contain image paths (e.g. heroImage,cover)")
  .option(
    "--field-mapping <json>",
    "JSON object mapping frontmatter keys to model property names"
  )
  .action(async (opts) => {
    if (opts.images !== false && !opts.storageBucket) {
      console.error(
        "Error: --storage-bucket is required unless --no-images is set.\n" +
        `Hint: --storage-bucket ${opts.projectId}.firebasestorage.app`
      );
      process.exit(1);
    }

    const fieldMapping = opts.fieldMapping
      ? (JSON.parse(opts.fieldMapping) as Record<string, string>)
      : undefined;

    const result = await mdImporter({
      mdDir: opts.mdDir,
      modelFile: opts.model,
      modelName: opts.modelName,
      firebaseConfig: {
        projectId: opts.projectId,
        credential: opts.credential,
        ...(opts.storageBucket ? { storageBucket: opts.storageBucket } : {}),
      },
      collection: opts.collection,
      fieldMapping,
      noImages: opts.images === false,
      imageBaseDir: opts.imageBaseDir,
      imageFields: opts.imageFields
        ? opts.imageFields.split(",").map((s: string) => s.trim())
        : undefined,
    });

    console.log(
      `Imported ${result.imported.length} file(s) successfully.`
    );

    if (result.errors.length > 0) {
      console.error(`Failed to import ${result.errors.length} file(s):`);
      for (const err of result.errors) {
        console.error(`  ${err.filePath}: ${err.error}`);
      }
      process.exit(1);
    }
  });

program.parse();
