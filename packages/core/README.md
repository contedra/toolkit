# @contedra/core

Core library for the Contedra toolkit — Firebase connection, Conteditor model parsing, and Zod schema generation.

## Installation

```bash
pnpm add @contedra/core
```

## API

### `loadModel(filePath: string, modelName?: string): Promise<ModelDefinition>`

Loads a Conteditor model definition from a JSON file. Two file shapes are accepted:

- **Easy format** — a single `ModelDefinition` object: `{ id, modelName, properties }`.
- **Manifest format** — a `ModelManifest` wrapper: `{ models: [...] }` (used by Conteditor's full-project export).

The optional `modelName` argument selects an entry from a manifest. Behaviour matrix:

| File shape | `modelName` | Result |
|---|---|---|
| single `ModelDefinition` | omitted | returns the object |
| single `ModelDefinition` | matches `model.modelName` | returns the object |
| single `ModelDefinition` | does not match | error |
| `ModelManifest` | omitted | error (ambiguous) |
| `ModelManifest` | matches one entry | returns that entry |
| `ModelManifest` | matches no entry | error |
| `ModelManifest` | matches multiple entries | error |

A bare-array file (`[ {...}, {...} ]`) is **not** accepted and triggers an explicit error.

### `resolveModel(parsed: unknown, filePath: string, modelName?: string): ModelDefinition`

Synchronous variant for callers that have already parsed the JSON (e.g., Astro Content Layer's `schema()` hook). Same selection rules as `loadModel`.

### `buildSchema(properties: ModelProperty[], bodyField?: string): ZodObject`

Builds a Zod validation schema from model properties. Excludes the `bodyField` property (handled separately by Astro).

### `dataTypeToZod(property: ModelProperty): ZodType`

Converts a single model property to its corresponding Zod schema type.

### `detectBodyField(model: ModelDefinition, explicitBodyField?: string): string | undefined`

Auto-detects the markdown body field from model properties by looking for `fieldType.element: "markdown"`. If `explicitBodyField` is provided, validates that it exists in the model.

### `initFirestore(config: FirebaseConfig): Firestore`

Initializes Firebase Admin SDK and returns a Firestore instance.

### `fetchDocuments(firestore: Firestore, collectionName: string): Promise<DocumentData[]>`

Fetches all documents from a Firestore collection.

### `transformDocumentData(data: Record<string, unknown>, model: ModelDefinition, bodyField?: string): Record<string, unknown>`

Converts Firestore document data to proper JS types (Timestamps to Dates, etc.).

## Types

```typescript
interface ModelDefinition {
  id: string;
  modelName: string;
  properties: ModelProperty[];
}

interface ModelManifest {
  models: ModelDefinition[];
}

type ModelFile = ModelDefinition | ModelManifest;

interface ModelProperty {
  propertyName: string;
  dataType: "string" | "datetime" | "relatedOne" | "relatedMany";
  fieldType?: { element?: string };
  require?: boolean;
  defaultValue?: unknown;
  relatedModel?: string;
}

interface FirebaseConfig {
  projectId: string;
  credential?: string; // Path to service account JSON
}
```

## JSON Schemas

The package ships JSON Schemas (Draft 2020-12) for validating model files in editors and CI:

```text
@contedra/core/schemas/model-definition.schema.json   # single ModelDefinition (Easy format)
@contedra/core/schemas/model-manifest.schema.json     # ModelManifest (multi-model format)
```

They are exposed through both `package.json` `exports` (Node-side `import`) and the npm tarball. **jsdelivr** automatically serves any file inside an npm package, so no separate hosting is needed.

`model-manifest.schema.json` keeps its `models[]` shape in sync with `model-definition.schema.json` by referencing it through a top-level `$ref` (the same version-pinned jsdelivr URL pattern as `$id`), so the `ModelDefinition` shape lives in exactly one place.

### URL convention — version-pinned `$id` / `$schema`

Each released schema file's `$id` is the version-pinned jsdelivr URL of the same release, for example:

```text
https://cdn.jsdelivr.net/npm/@contedra/core@<VERSION>/schemas/model-manifest.schema.json
```

Pinning to a specific version gives the schema versioned-contract semantics: any breaking change ships under a new URL. Users reference the same pinned URL via `$schema` from their model files so editor and CI tooling cache deterministically.

### Reference a schema from your model file

```jsonc
// my-models.json
{
  "$schema": "https://cdn.jsdelivr.net/npm/@contedra/core@<VERSION>/schemas/model-manifest.schema.json",
  "models": [
    { "id": "...", "modelName": "blog", "properties": [/* ... */] }
  ]
}
```

### Source placeholder & release rewrite

The schemas in source use `@contedra/core@0.0.0-PLACEHOLDER` to keep PRs free of version churn. The `prepack` script (`scripts/rewrite-schema-ids.mjs`) rewrites the `$id` to the actual version of `@contedra/core` just before publish, so the published artifact and the URL clients use line up exactly.

## License

MIT
