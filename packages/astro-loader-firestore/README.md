# @contedra/astro-loader-firestore

Astro Content Layer loader for Conteditor-managed Firestore collections. Loads content and exposes it through Astro's Content Layer API (v5+).

## Installation

```bash
pnpm add @contedra/astro-loader-firestore
```

**Peer dependency:** `astro >= 5.0.0`

## Usage

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

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `modelFile` | `string` | Yes | Path to the Conteditor model JSON file |
| `firebaseConfig.projectId` | `string` | Yes | Firebase project ID |
| `firebaseConfig.credential` | `string` | No | Path to service account JSON (uses ADC if omitted) |
| `collection` | `string` | No | Firestore collection name (defaults to `modelName`) |
| `bodyField` | `string` | No | Field to map to Astro's `body` (auto-detects `element: "markdown"` fields) |

## Data Type Mapping

| Conteditor `dataType` | Zod Schema | Description |
|------------------------|------------|-------------|
| `string` | `z.string()` | Plain string |
| `datetime` | `z.coerce.date()` | Firestore Timestamp converted to Date |
| `relatedOne` | `z.string()` | Referenced document ID |
| `relatedMany` | `z.array(z.string())` | Array of referenced document IDs |

## Resolving References

The loader maps `relatedOne` and `relatedMany` fields to document ID strings. Resolve them with `getEntry()`:

```typescript
---
import { getCollection, getEntry } from "astro:content";

const posts = await getCollection("blogPosts");

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

## Authentication

**With `credential`** (local development):

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

When `credential` is omitted, the loader uses [ADC](https://cloud.google.com/docs/authentication/application-default-credentials). Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or use Workload Identity Federation in CI/CD.

## License

MIT
