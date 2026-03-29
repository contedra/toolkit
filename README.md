# Contedra Toolkit

Tools for building content-driven sites with [Conteditor](https://github.com/contedra)-managed Firestore and Astro.

## Packages

| Package | Description |
|---------|-------------|
| [`@contedra/core`](./packages/core) | Core library — Firebase connection, model parsing, and Zod schema generation |
| [`@contedra/astro-loader-firestore`](./packages/astro-loader-firestore) | Astro Content Layer loader for Conteditor Firestore |
| [`@contedra/md-importer`](./packages/md-importer) | CLI tool to import Markdown files + images into Firestore |

## Quick Start

### Astro Loader

```bash
pnpm add @contedra/astro-loader-firestore
```

Define a content collection in your Astro project:

```typescript
// src/content/config.ts
import { defineCollection } from "astro:content";
import { contedraLoader } from "@contedra/astro-loader-firestore";

const blogPosts = defineCollection({
  loader: contedraLoader({
    modelFile: "./models/blog_posts.json",
    firebaseConfig: {
      projectId: "your-project-id",
      credential: "./service-account.json",
    },
  }),
});

export const collections = { blogPosts };
```

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `modelFile` | `string` | Yes | Path to the Conteditor model JSON file |
| `firebaseConfig.projectId` | `string` | Yes | Firebase project ID |
| `firebaseConfig.credential` | `string` | No | Path to service account JSON (uses ADC if omitted) |
| `collection` | `string` | No | Firestore collection name (defaults to `modelName`) |
| `bodyField` | `string` | No | Field to map to Astro's `body` (auto-detects `element: "markdown"` fields) |

#### Data Type Mapping

| Conteditor `dataType` | Zod Schema | Description |
|------------------------|------------|-------------|
| `string` | `z.string()` | Plain string |
| `datetime` | `z.coerce.date()` | Firestore Timestamp converted to Date |
| `relatedOne` | `z.string()` | Referenced document ID |
| `relatedMany` | `z.array(z.string())` | Array of referenced document IDs |

#### Authentication

**With `credential` option** (local development):

```typescript
firebaseConfig: {
  projectId: "your-project-id",
  credential: "./service-account.json",
}
```

**Without `credential`** (Application Default Credentials):

```typescript
firebaseConfig: {
  projectId: "your-project-id",
}
```

When `credential` is omitted, the loader uses [Application Default Credentials (ADC)](https://cloud.google.com/docs/authentication/application-default-credentials). Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or use Workload Identity Federation in CI/CD environments.

### Markdown Importer

```bash
pnpm add @contedra/md-importer
```

#### CLI Usage

```bash
npx @contedra/md-importer \
  --md-dir ./content \
  --model ./models/blog_posts.json \
  --project-id your-project-id \
  --credential ./service-account.json
```

**CLI Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--md-dir <path>` | Yes | Directory containing `.md` files |
| `--model <path>` | Yes | Path to model definition JSON |
| `--project-id <id>` | Yes | Firebase project ID |
| `--credential <path>` | No | Path to service account JSON (uses ADC if omitted) |
| `--collection <name>` | No | Firestore collection name (defaults to `modelName`) |
| `--field-mapping <json>` | No | JSON mapping frontmatter keys to model properties |

**Example with field mapping:**

```bash
npx @contedra/md-importer \
  --md-dir ./content \
  --model ./models/blog_posts.json \
  --project-id your-project-id \
  --field-mapping '{"article_title":"title","article_date":"publishedAt"}'
```

#### Programmatic API

```typescript
import { mdImporter } from "@contedra/md-importer";

const result = await mdImporter({
  mdDir: "./content",
  modelFile: "./models/blog_posts.json",
  firebaseConfig: {
    projectId: "your-project-id",
    credential: "./service-account.json",
  },
  fieldMapping: {
    article_title: "title",
    article_date: "publishedAt",
  },
});

console.log(`Imported: ${result.imported.length}`);
console.log(`Errors: ${result.errors.length}`);
```

#### Custom Image Resolver

By default, images referenced in markdown are read from the local filesystem relative to the `.md` file and uploaded to Firebase Storage. You can provide a custom resolver:

```typescript
const result = await mdImporter({
  mdDir: "./content",
  modelFile: "./models/blog_posts.json",
  firebaseConfig: { projectId: "your-project-id" },
  resolveImage: async (imagePath, mdFilePath) => {
    // Custom logic — e.g., fetch from a remote URL or CDN
    const response = await fetch(`https://cdn.example.com/${imagePath}`);
    return Buffer.from(await response.arrayBuffer());
  },
});
```

## Model JSON Format

Both the Astro loader and Markdown importer use Conteditor model definition JSON files to define the schema of your content:

```json
{
  "id": "blog_posts",
  "modelName": "blog_posts",
  "properties": [
    { "propertyName": "title", "dataType": "string", "require": true },
    { "propertyName": "content", "dataType": "string", "fieldType": { "element": "markdown" } },
    { "propertyName": "publishedAt", "dataType": "datetime" },
    { "propertyName": "category", "dataType": "relatedOne", "relatedModel": "categories" },
    { "propertyName": "tags", "dataType": "relatedMany", "relatedModel": "tags" }
  ]
}
```

**Supported `dataType` values:** `string`, `datetime`, `relatedOne`, `relatedMany`

A property with `"fieldType": { "element": "markdown" }` is automatically detected as the body field for Astro's content rendering.

## Demo

A demo Astro project is included in the [`demo/`](./demo) directory. It uses the Firestore emulator with sample blog posts and tags. See [demo/README.md](./demo/README.md) for setup instructions.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Versioning

All packages share the same version number. Use the built-in scripts to bump versions:

```bash
# Bump patch version (e.g., 0.1.0 → 0.1.1)
pnpm version:patch

# Bump minor version (e.g., 0.1.0 → 0.2.0)
pnpm version:minor

# Bump major version (e.g., 0.1.0 → 1.0.0)
pnpm version:major
```

After bumping, commit and tag:

```bash
pnpm version:patch   # outputs "v0.1.1"
git add -A && git commit -m "chore: bump to v0.1.1"
git tag v0.1.1 && git push origin main --tags
```

Pushing the tag triggers the [publish workflow](./.github/workflows/publish.yml), which builds and publishes all packages to npm.

## Publishing

Packages are published to npm under the `@contedra` scope via GitHub Actions. Pushing a version tag (e.g., `v0.1.1`) triggers the [publish workflow](./.github/workflows/publish.yml), which builds and publishes all packages.

**Requirements:** Set the `NPM_TOKEN` secret in your GitHub repository settings.

## License

MIT
