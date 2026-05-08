export interface ModelProperty {
  propertyName: string;
  dataType: "string" | "datetime" | "relatedOne" | "relatedMany";
  fieldType?: {
    element: string;
  };
  require?: boolean;
  defaultValue?: string;
  relatedModel?: string;
}

export interface ModelDefinition {
  id: string;
  modelName: string;
  properties: ModelProperty[];
}

export interface ModelManifest {
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
