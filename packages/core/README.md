# @contedra/core

Core library for the Contedra toolkit — Firebase connection, Conteditor model parsing, and Zod schema generation.

## Installation

```bash
pnpm add @contedra/core
```

## API

### `loadModel(filePath: string): ModelDefinition`

Loads a Conteditor model definition from a JSON file.

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

## License

MIT
