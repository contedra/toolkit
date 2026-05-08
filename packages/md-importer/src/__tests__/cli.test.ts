import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";

/**
 * We test CLI option parsing by constructing a Command with the same
 * options as cli.ts and calling parseAsync with synthetic argv.
 */
function buildProgram(actionFn: (...args: unknown[]) => void) {
  const program = new Command();
  program
    .name("md-importer")
    .requiredOption("--md-dir <path>", "Directory containing .md files")
    .requiredOption("--model <path>", "Path to model definition JSON")
    .requiredOption("--project-id <id>", "Firebase project ID")
    .option("--credential <path>", "Path to service account JSON")
    .option("--model-name <name>", "Model name from manifest")
    .option("--collection <name>", "Firestore collection name")
    .option("--storage-bucket <name>", "Firebase Storage bucket name")
    .option("--no-images", "Skip image processing")
    .option("--field-mapping <json>", "JSON field mapping")
    .action(actionFn);
  program.exitOverride(); // throw instead of process.exit
  return program;
}

describe("CLI option parsing", () => {
  it("parses --storage-bucket option", async () => {
    const actionFn = vi.fn();
    const program = buildProgram(actionFn);

    await program.parseAsync([
      "node",
      "md-importer",
      "--md-dir",
      "./content",
      "--model",
      "./model.json",
      "--project-id",
      "my-project",
      "--storage-bucket",
      "my-project.firebasestorage.app",
    ]);

    expect(actionFn).toHaveBeenCalled();
    const opts = actionFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.storageBucket).toBe("my-project.firebasestorage.app");
    expect(opts.images).toBe(true);
  });

  it("parses --no-images flag", async () => {
    const actionFn = vi.fn();
    const program = buildProgram(actionFn);

    await program.parseAsync([
      "node",
      "md-importer",
      "--md-dir",
      "./content",
      "--model",
      "./model.json",
      "--project-id",
      "my-project",
      "--no-images",
    ]);

    expect(actionFn).toHaveBeenCalled();
    const opts = actionFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.images).toBe(false);
  });

  it("parses --model-name option", async () => {
    const actionFn = vi.fn();
    const program = buildProgram(actionFn);

    await program.parseAsync([
      "node",
      "md-importer",
      "--md-dir",
      "./content",
      "--model",
      "./manifest.json",
      "--model-name",
      "blog_posts",
      "--project-id",
      "my-project",
      "--storage-bucket",
      "my-project.firebasestorage.app",
    ]);

    const opts = actionFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.modelName).toBe("blog_posts");
  });

  it("defaults images to true when --no-images is not set", async () => {
    const actionFn = vi.fn();
    const program = buildProgram(actionFn);

    await program.parseAsync([
      "node",
      "md-importer",
      "--md-dir",
      "./content",
      "--model",
      "./model.json",
      "--project-id",
      "my-project",
      "--storage-bucket",
      "bucket",
    ]);

    const opts = actionFn.mock.calls[0]![0] as Record<string, unknown>;
    expect(opts.images).toBe(true);
  });
});
