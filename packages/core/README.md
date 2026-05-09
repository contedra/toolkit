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

contedra's content model definition format. The TypeScript interfaces below and the bundled JSON Schemas describe the same shape: a model is a list of typed properties (`dataType`-discriminated — `string` with a UI hint, `datetime`, `relatedOne`, `relatedMany`, `asset`) intended for headless-CMS-style backends.

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
  | RelatedManyProperty
  | AssetProperty;

type FieldElement = "input" | "textarea" | "markdown" | "select";
type SearchPriority = "high" | "normal" | "low" | "none";
type MediaType = "image"; // MVP — minor versions will add `video` / `audio` / `file`

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

interface AssetProperty {
  propertyName: string;
  dataType: "asset";
  mediaType: MediaType; // required, MVP: "image" only
  require?: boolean;
  // No `defaultValue`: an asset URI is contentId-scoped and cannot be
  // hard-coded in the model definition.
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
| `"asset"` | `propertyName`, `dataType`, `mediaType` (MediaType) | `require` |

Each property variant is `additionalProperties: false` in the JSON Schema so accidental keys are caught at validation time.

### `asset` dataType — references to Firebase Storage objects

An `asset` property holds a logical reference to a Firebase Storage object, parallel to how `relatedOne` / `relatedMany` reference documents in another collection. The persisted value is an `asset://` URI:

```text
asset://{modelName}/{contentId}/{fileId}
```

Example value: `asset://blog/abc123/cover.jpg`. The URI is logical, not physical — bucket name or storage path can change without rewriting the stored value; consumer-side resolvers (e.g. `resolveAssetUriToUrl`, `parseAssetUri`) do the lookup.

Example model snippet:

```json
{
  "id": "blog",
  "modelName": "blog",
  "properties": [
    { "propertyName": "title", "dataType": "string", "fieldType": { "element": "input" }, "require": true },
    { "propertyName": "cover", "dataType": "asset", "mediaType": "image", "require": true },
    { "propertyName": "thumbnail", "dataType": "asset", "mediaType": "image" }
  ]
}
```

#### `mediaType` is a UI-branch enum, not a MIME type

`mediaType` is **required** on every asset property and switches the editor / display UI (e.g. an image picker + preview vs. a video player). It is intentionally a coarse category, not a MIME type — keeping it small is what makes the picker UI tractable in a CMS surface.

The MVP enum has a single value, `"image"`. Future minor versions of the schema will extend the enum with values like `"video"`, `"audio"`, and `"file"` as the corresponding pickers ship; consumers should treat unknown values as a hard validation error rather than silently downgrading.

#### Why `defaultValue` is intentionally absent

`asset` properties do not carry a `defaultValue`. An `asset://` URI is content-scoped (the `contentId` segment changes per document), so there is no useful value to hard-code in the model definition. Validators reject any `defaultValue` key on an asset property via `additionalProperties: false`.

## JSON Schemas

The package ships JSON Schemas (Draft 2020-12) for validating model files in editors and CI. Each release of the schemas lives under a semver directory; the current schema version is exported as `SCHEMA_VERSION` from `@contedra/core`:

```text
@contedra/core/schemas/1.1.0/model-definition.schema.json   # single ModelDefinition (Easy format)
@contedra/core/schemas/1.1.0/model-manifest.schema.json     # ModelManifest (multi-model format)
```

Older schema versions are kept alongside (`schemas/1.0.0/...`) so files pinned to an earlier `$schema` URL keep validating; the `@contedra/core/valibot` subpath always resolves to the current `SCHEMA_VERSION`.

They are exposed through both `package.json` `exports` (Node-side `import`) and the npm tarball. **jsdelivr** automatically serves any file inside an npm package, so no separate hosting is needed.

`model-manifest.schema.json` keeps its `models[]` shape in sync with `model-definition.schema.json` by referencing it through a top-level `$ref` (the same versioned jsdelivr URL pattern as `$id`), so the `ModelDefinition` shape lives in exactly one place.

### Schema 1.1.0 — what changed

`1.1.0` is purely additive over `1.0.0`:

- New `$defs.MediaType` (enum, MVP value `"image"`).
- New `$defs.AssetProperty` and a fifth `Property.oneOf` branch for `dataType: "asset"`.
- Existing dataTypes (`string`, `datetime`, `relatedOne`, `relatedMany`) and their fields are unchanged. Files written against `1.0.0` continue to validate against `1.1.0`.

### URL convention — schema version pinned, package version free

Each schema file's `$id` is a jsdelivr URL whose path carries the **schema** version (not the npm package version). jsdelivr resolves `@contedra/core` to whatever release is current, and as long as `@contedra/core` keeps shipping `schemas/<SCHEMA_VERSION>/...`, the URL stays stable forever:

```text
https://cdn.jsdelivr.net/npm/@contedra/core/schemas/1.1.0/model-manifest.schema.json
```

A breaking schema change bumps `SCHEMA_VERSION` and ships under a fresh URL (`schemas/2.0.0/...`); existing files keep validating against the old URL. Additive changes (e.g. the `1.0.0` → `1.1.0` AssetProperty addition) ship under a new minor segment so consumers can opt in by changing the URL.

### Reference a schema from your model file

```jsonc
// my-models.json
{
  "$schema": "https://cdn.jsdelivr.net/npm/@contedra/core/schemas/1.1.0/model-manifest.schema.json",
  "models": [
    { "id": "...", "modelName": "blog", "properties": [/* ... */] }
  ]
}
```

## Generated valibot schemas (`@contedra/core/valibot`)

The same JSON Schemas are also published as a generated [valibot](https://valibot.dev) module so consumers that already validate with valibot can drop them in directly:

```ts
import { safeParse } from "valibot";
import {
  ModelDefinitionSchema,
  ModelManifestSchema,
  ModelIdSchema,
  ModelNameSchema,
} from "@contedra/core/valibot";

// Single ModelDefinition (Easy format)
const single = safeParse(ModelDefinitionSchema, jsonFromDisk);

// ModelManifest ({ $schema?, models: [...] }) — typical when consumers
// import a multi-model file and then process each entry as a definition
const manifest = safeParse(ModelManifestSchema, jsonFromDisk);
if (manifest.success) {
  for (const model of manifest.output.models) {
    // each `model` is already validated against ModelDefinitionSchema
  }
}
```

Both schemas come from the same `@contedra/core/valibot` subpath. `ModelManifestSchema` accepts the manifest's `$schema` header (and any other top-level keys) since the underlying JSON Schema is `additionalProperties: true`; the inner `models[]` items are validated against the same `ModelDefinitionSchema` exported above, so there is exactly one source of truth for the model shape.

The valibot modules under `packages/core/generated/<SCHEMA_VERSION>/` are auto-generated by `scripts/generate-valibot.mjs` from the JSON Schemas; do not edit by hand. Run `pnpm -F @contedra/core generate:valibot` to refresh them after schema changes. The `@contedra/core/valibot` entry point always resolves to the current `SCHEMA_VERSION`.

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
