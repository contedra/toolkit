/**
 * Content model property types. A property is a discriminated union over
 * `dataType` (string | datetime | relatedOne | relatedMany); see the
 * accompanying JSON Schema (`@contedra/core/schemas/model-definition.schema.json`)
 * for the canonical shape.
 */

export type FieldElement = "input" | "textarea" | "markdown" | "select";

export type SearchPriority = "high" | "normal" | "low" | "none";

/**
 * Boolean `true` marks the field required. A string value carries a UI
 * validation message and is treated as truthy.
 */
export type RequireFlag = boolean | string;

export interface StringProperty {
  propertyName: string;
  dataType: "string";
  fieldType: { element: FieldElement };
  require?: RequireFlag;
  min?: number;
  max?: number;
  regex?: string;
  defaultValue?: string;
  searchPriority?: SearchPriority;
}

export interface DatetimeProperty {
  propertyName: string;
  dataType: "datetime";
  require?: RequireFlag;
  defaultValue?: string;
  onUpdate?: string;
}

export interface RelatedOneProperty {
  propertyName: string;
  dataType: "relatedOne";
  relatedModel: string;
  require?: RequireFlag;
  defaultValue?: string;
}

export interface RelatedManyProperty {
  propertyName: string;
  dataType: "relatedMany";
  relatedModel: string;
  require?: RequireFlag;
  defaultValue?: string;
}

export type ModelProperty =
  | StringProperty
  | DatetimeProperty
  | RelatedOneProperty
  | RelatedManyProperty;

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
