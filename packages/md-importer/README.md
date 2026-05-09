# @contedra/md-importer

CLI tool and library to import YAML-frontmatter Markdown files (with images) into Firestore, using a content model definition JSON for schema validation.

## Installation

```bash
pnpm add @contedra/md-importer
```

## CLI Usage

```bash
npx @contedra/md-importer \
  --md-dir ./content \
  --model ./models/blog_posts.json \
  --project-id your-project-id \
  --credential ./service-account.json \
  --storage-bucket your-project-id.firebasestorage.app
```

### CLI Options

| Option | Required | Description |
|--------|----------|-------------|
| `--md-dir <path>` | Yes | Directory containing `.md` files |
| `--model <path>` | Yes | Path to model definition JSON (single `ModelDefinition` or `ModelManifest`) |
| `--model-name <name>` | Conditional | Model name to select from a manifest (required when `--model` points to a `ModelManifest` with multiple models) |
| `--project-id <id>` | Yes | Firebase project ID |
| `--credential <path>` | No | Path to service account JSON (uses ADC if omitted) |
| `--collection <name>` | No | Firestore collection name (defaults to `modelName`) |
| `--storage-bucket <name>` | No* | Firebase Storage bucket name (e.g. `your-project.firebasestorage.app`) |
| `--no-images` | No | Skip image extraction, upload, and URL replacement |
| `--image-base-dir <path>` | No | Directory for resolving absolute image paths (e.g. `./public`) |
| `--image-fields <fields>` | No | Comma-separated frontmatter field names containing image paths (e.g. `heroImage,cover`). Only needed for `dataType: "string"` fields; `dataType: "asset"` fields are auto-recognized. |
| `--field-mapping <json>` | No | JSON mapping frontmatter keys to model properties |

### Importing from a multi-model manifest file

Use `--model-name` to select one model out of a `{ "models": [...] }` file:

```bash
npx @contedra/md-importer \
  --md-dir ./content/blog \
  --model ./models/site-models.json \
  --model-name blog_posts \
  --project-id your-project-id \
  --storage-bucket your-project.firebasestorage.app
```

> \* `--storage-bucket` is required unless `--no-images` is set.

### Field Mapping

When your Markdown frontmatter keys don't match the model property names, use `--field-mapping`:

```bash
npx @contedra/md-importer \
  --md-dir ./content \
  --model ./models/blog_posts.json \
  --project-id your-project-id \
  --field-mapping '{"article_title":"title","article_date":"publishedAt"}'
```

Unmapped frontmatter keys that match model property names are auto-matched.

## Programmatic API

### `mdImporter(config): Promise<ImportResult>`

```typescript
import { mdImporter } from "@contedra/md-importer";

const result = await mdImporter({
  mdDir: "./content",
  modelFile: "./models/blog_posts.json",
  // modelName: "blog_posts",  // required when modelFile is a ModelManifest with multiple models
  firebaseConfig: {
    projectId: "your-project-id",
    credential: "./service-account.json",
    storageBucket: "your-project-id.firebasestorage.app",
  },
  fieldMapping: {
    article_title: "title",
    article_date: "publishedAt",
  },
  imageFields: ["heroImage", "cover"],  // frontmatter fields containing image paths
  // noImages: true,  // set to skip all image processing
});

console.log(`Imported: ${result.imported.length}`);
console.log(`Errors: ${result.errors.length}`);
```

### Custom Image Resolver

By default, local images referenced in Markdown are read from the filesystem and uploaded to Firebase Storage (`assets/{modelName}/{contentId}/{fileName}`). Provide a custom resolver to change this behavior:

```typescript
const result = await mdImporter({
  mdDir: "./content",
  modelFile: "./models/blog_posts.json",
  firebaseConfig: { projectId: "your-project-id" },
  resolveImage: async (imagePath, mdFilePath) => {
    const response = await fetch(`https://cdn.example.com/${imagePath}`);
    return Buffer.from(await response.arrayBuffer());
  },
});
```

### Helper Functions

- `generateDocId(filePath)` — Converts a filename to a slugified Firestore document ID
- `parseMarkdownFile(filePath)` — Parses a `.md` file into `{ frontmatter, body }`
- `parseMarkdownString(content)` — Parses a markdown string (uses gray-matter)
- `mapFields(frontmatter, model, fieldMapping?)` — Maps frontmatter fields to model properties, returns `{ data, unmapped }`

## Image Handling

Images referenced in Markdown (e.g., `![alt](./images/photo.png)`) are:

1. Extracted from the markdown body
2. Resolved via the local filesystem (or custom `resolveImage`)
3. Uploaded to Firebase Storage at `assets/{modelName}/{contentId}/{fileName}`
4. Replaced in the markdown body with `asset://` URIs

External URLs (`http://`, `https://`) and `asset://` URIs are skipped.

## Frontmatter Image Fields

Two paths are supported for converting frontmatter image paths into `asset://` URIs:

### 1. `dataType: "asset"` (recommended, auto-recognized)

If a model property is declared as `dataType: "asset"` with `mediaType: "image"`, the importer **automatically uploads** the value (a relative or absolute path) and rewrites the frontmatter field to an `asset://` URI. No `--image-fields` flag needed.

```json
// model.json
{
  "id": "blog_posts",
  "modelName": "blog_posts",
  "properties": [
    { "propertyName": "title", "dataType": "string", "fieldType": { "element": "input" }, "require": true },
    { "propertyName": "cover", "dataType": "asset", "mediaType": "image", "require": true },
    { "propertyName": "thumbnail", "dataType": "asset", "mediaType": "image" }
  ]
}
```

```yaml
# post.md frontmatter
title: Hello
cover: ./images/cover.png
thumbnail: ./images/thumb.png
```

After import: `cover` and `thumbnail` are stored as `asset://blog_posts/{docId}/cover.png` and `asset://blog_posts/{docId}/thumb.png`. Values that are already `asset://`, `http://`, or `https://` URIs are passed through unchanged (idempotent re-import).

> **MVP note:** only `mediaType: "image"` triggers upload today. Future schema versions will add `video` / `audio` / `file`; until then, those values are rejected by `@contedra/core` schema validation.

### 2. `--image-fields` (legacy, for `dataType: "string"` fields)

For models that store image paths in plain `string`-typed fields, pass `--image-fields` to opt-in field-by-field. This path remains available for backward compatibility.

```bash
npx @contedra/md-importer ... --image-fields heroImage,cover
```

The two paths can be combined; if a field is named in both an `asset` property and `--image-fields`, it is uploaded once.

## License

MIT
