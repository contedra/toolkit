# @contedra/astro-loader-firestore

Astro Content Layer loader for Firestore.

Loads content from a Conteditor-managed Firestore collection and exposes it through Astro's Content Layer API (v5+).

## Installation

```bash
npm install @contedra/astro-loader-firestore
# or
pnpm add @contedra/astro-loader-firestore
```

## Usage

### 1. Define your content collection

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

### 2. Model JSON format

The loader reads Conteditor model definition JSON files:

```json
{
  "id": "blog_posts",
  "modelName": "blog_posts",
  "properties": [
    { "propertyName": "title", "dataType": "string", "require": true },
    { "propertyName": "content", "dataType": "string" },
    { "propertyName": "publishedAt", "dataType": "datetime" },
    { "propertyName": "category", "dataType": "relatedOne", "relatedModel": "categories" }
  ]
}
```

### 3. Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `modelFile` | `string` | Yes | Path to the Conteditor model JSON file |
| `firebaseConfig.projectId` | `string` | Yes | Firebase project ID |
| `firebaseConfig.credential` | `string` | No | Path to service account JSON (uses ADC if omitted) |
| `collection` | `string` | No | Firestore collection name (defaults to `modelName`) |
| `bodyField` | `string` | No | Field to map to Astro's `body` (auto-detects `element: "markdown"` fields) |

### 4. Data type mapping

| Conteditor `dataType` | Zod Schema | Description |
|------------------------|------------|-------------|
| `string` | `z.string()` | Plain string |
| `datetime` | `z.coerce.date()` | Firestore Timestamp converted to Date |
| `relatedOne` | `z.string()` | Referenced document ID |
| `relatedMany` | `z.array(z.string())` | Array of referenced document IDs |

### 5. Resolving references

The loader maps `relatedOne` and `relatedMany` fields to document ID strings. To resolve them, use `getEntry()` from `astro:content`:

```typescript
---
import { getCollection, getEntry } from "astro:content";

const posts = await getCollection("blogPosts");

// Resolve a relatedMany field (tags)
for (const post of posts) {
  const tags = [];
  for (const tagId of post.data.tags ?? []) {
    const tag = await getEntry("tags", tagId);
    if (tag) tags.push(tag);
  }
}
---
```

> **Note:** Astro's `reference()` helper cannot be used in custom loader schemas because the Loader `schema` function does not receive a schema context that includes `reference()`. Use manual resolution with `getEntry()` instead.

### 6. Authentication

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

## Demo

A demo Astro project is included in the `demo/` directory. It uses the Firestore emulator with sample blog posts and tags.

### Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) with the Firestore emulator

### Running the demo

```bash
# Start the Firestore emulator
cd demo
pnpm emulator

# In another terminal:
cd demo
pnpm seed       # Seeds the emulator with sample data
pnpm dev        # Starts the Astro dev server
```

Set `FIRESTORE_EMULATOR_HOST=localhost:8080` to point the loader at the emulator.

### Regression tests

The demo includes snapshot tests that verify the built HTML output against stored snapshots. This detects regressions in markdown rendering, tag resolution, datetime formatting, etc.

```bash
# With the Firestore emulator running:
cd demo
pnpm test:regression    # seed → build → snapshot test

# Or if dist/ is already built:
pnpm test               # run snapshot tests only
```

To update snapshots after intentional changes:

```bash
cd demo
pnpm test -- --update
```

## License

MIT
