/**
 * Content model property types. A property is a discriminated union over
 * `dataType` (string | datetime | relatedOne | relatedMany); see the
 * accompanying JSON Schema (`@contedra/core/schemas/model-definition.schema.json`)
 * for the canonical shape.
 */

export type FieldElement = "input" | "textarea" | "markdown" | "select";

export type SearchPriority = "high" | "normal" | "low" | "none";

/**
 * Asset broad category. Matches MediaType in the JSON Schema 1.1.0 / valibot.
 * MVP supports `image` only; future minor versions will add `video` / `audio` / `file`.
 */
export type MediaType = "image";

export interface StringProperty {
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

export interface DatetimeProperty {
  propertyName: string;
  dataType: "datetime";
  require?: boolean;
  defaultValue?: string;
  onUpdate?: string;
}

export interface RelatedOneProperty {
  propertyName: string;
  dataType: "relatedOne";
  relatedModel: string;
  require?: boolean;
  defaultValue?: string;
}

export interface RelatedManyProperty {
  propertyName: string;
  dataType: "relatedMany";
  relatedModel: string;
  require?: boolean;
  defaultValue?: string;
}

export interface AssetProperty {
  propertyName: string;
  dataType: "asset";
  mediaType: MediaType;
  require?: boolean;
}

export type ModelProperty =
  | StringProperty
  | DatetimeProperty
  | RelatedOneProperty
  | RelatedManyProperty
  | AssetProperty;

export interface ModelDefinition {
  id: string;
  modelName: string;
  properties: ModelProperty[];
}

export interface ModelManifest {
  /** Must contain at least one entry; loadModel rejects empty manifests at runtime. */
  models: ModelDefinition[];
}

export type ModelFile = ModelDefinition | ModelManifest;

export interface FirebaseConfig {
  projectId: string;
  /** Path to service account JSON (uses Application Default Credentials if omitted) */
  credential?: string;
  /** Firebase Storage bucket name (e.g. "my-project.firebasestorage.app") */
  storageBucket?: string;
}
