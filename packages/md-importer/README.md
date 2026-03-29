# @contedra/md-importer

CLI tool and library to import YAML-frontmatter Markdown files (with images) into Firestore, using Conteditor model definition JSON for schema validation.

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
  --credential ./service-account.json
```

### CLI Options

| Option | Required | Description |
|--------|----------|-------------|
| `--md-dir <path>` | Yes | Directory containing `.md` files |
| `--model <path>` | Yes | Path to model definition JSON |
| `--project-id <id>` | Yes | Firebase project ID |
| `--credential <path>` | No | Path to service account JSON (uses ADC if omitted) |
| `--collection <name>` | No | Firestore collection name (defaults to `modelName`) |
| `--field-mapping <json>` | No | JSON mapping frontmatter keys to model properties |

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

## License

MIT
