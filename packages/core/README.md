# @contedra/core

Core library for the contedra toolkit — Firebase connection, content model parsing, and Zod schema generation.

## Installation

```bash
pnpm add @contedra/core
```

## API

### `loadModel(filePath: string, modelName?: string): Promise<ModelDefinition>`

Loads a content model definition from a JSON file. Two file shapes are accepted:

- **Easy format** — a single `ModelDefinition` object: `{ id, modelName, properties }`.
- **Manifest format** — a `ModelManifest` wrapper: `{ models: [...] }` (carries multiple model definitions in a single file).

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

contedra's content model definition format. The TypeScript interfaces below and the bundled JSON Schemas describe the same shape: a model is a list of typed properties (`dataType`-discriminated — `string` with a UI hint, `datetime`, `relatedOne`, `relatedMany`) intended for headless-CMS-style backends.

```typescript
interface ModelDefinition {
  id: string;          // ModelId — /^[a-zA-Z0-9_-]+$/, 1-128 chars
  modelName: string;   // ModelName — /^[a-z][a-z0-9_]*$/, 3-64 chars
  properties: ModelProperty[];
}

interface ModelManifest {
  models: ModelDefinition[];
}

type ModelFile = ModelDefinition | ModelManifest;

type ModelProperty =
  | StringProperty
  | DatetimeProperty
  | RelatedOneProperty
  | RelatedManyProperty;

type FieldElement = "input" | "textarea" | "markdown" | "select";
type SearchPriority = "high" | "normal" | "low" | "none";

interface StringProperty {
  propertyName: string;
  dataType: "string";
  fieldType: { element: FieldElement };
  require?: boolean;
  min?: number;
  max?: number;
  regex?: string;
  defaultValue?: string;
  searchPriority?: SearchPriority;
}

interface DatetimeProperty {
  propertyName: string;
  dataType: "datetime";
  require?: boolean;
  defaultValue?: string;
  onUpdate?: string;
}

interface RelatedOneProperty {
  propertyName: string;
  dataType: "relatedOne";
  relatedModel: string; // ModelId
  require?: boolean;
  defaultValue?: string;
}

interface RelatedManyProperty {
  propertyName: string;
  dataType: "relatedMany";
  relatedModel: string; // ModelId
  require?: boolean;
  defaultValue?: string;
}

interface FirebaseConfig {
  projectId: string;
  credential?: string; // Path to service account JSON
}
```

### Property variants at a glance

| `dataType` | Required keys | Optional keys |
|---|---|---|
| `"string"` | `propertyName`, `dataType`, `fieldType.element` (`input`/`textarea`/`markdown`/`select`) | `require`, `min`, `max`, `regex`, `defaultValue`, `searchPriority` |
| `"datetime"` | `propertyName`, `dataType` | `require`, `defaultValue`, `onUpdate` |
| `"relatedOne"` | `propertyName`, `dataType`, `relatedModel` (ModelId) | `require`, `defaultValue` |
| `"relatedMany"` | `propertyName`, `dataType`, `relatedModel` (ModelId) | `require`, `defaultValue` |

Each property variant is `additionalProperties: false` in the JSON Schema so accidental keys are caught at validation time.

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

## Generated valibot schemas (`@contedra/core/valibot`)

The same JSON Schemas are also published as a generated [valibot](https://valibot.dev) module so consumers that already validate with valibot can drop them in directly:

```ts
import { safeParse } from "valibot";
import {
  ModelDefinitionSchema,
  ModelManifestSchema, // when added
  ModelIdSchema,
  ModelNameSchema,
} from "@contedra/core/valibot";

const result = safeParse(ModelDefinitionSchema, jsonFromDisk);
```

`packages/core/generated/model-definition.valibot.ts` is auto-generated by `scripts/generate-valibot.mjs` from the JSON Schema; do not edit by hand. Run `pnpm -F @contedra/core generate:valibot` to refresh it after schema changes.

### Brand wrapping is a consumer concern

The generated schemas **do not call `brand(...)`**. contedra is intentionally generic — branding a `ModelId` or `ModelName` ties the value to a particular domain, and that decision belongs to the consumer, not to the toolkit.

If you want branded types in your codebase, wrap the generated schemas at your own boundary:

```ts
import { brand, pipe } from "valibot";
import {
  ModelIdSchema as GeneratedModelIdSchema,
  ModelNameSchema as GeneratedModelNameSchema,
} from "@contedra/core/valibot";

export const ModelIdSchema = pipe(GeneratedModelIdSchema, brand("ModelId"));
export const ModelNameSchema = pipe(GeneratedModelNameSchema, brand("ModelName"));
```

That way the upstream constraints (regex / length / enum) stay shared with the toolkit, and the brand stays a property of your domain layer.

## License

MIT
