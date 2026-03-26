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

export interface ContedraLoaderConfig {
  /** Path to the Conteditor model JSON file */
  modelFile: string;
  /** Field name to map to Astro's body (auto-detects element:"markdown" if omitted) */
  bodyField?: string;
  /** Firebase configuration */
  firebaseConfig: {
    projectId: string;
    /** Path to service account JSON (uses Application Default Credentials if omitted) */
    credential?: string;
  };
  /** Firestore collection name (defaults to modelName) */
  collection?: string;
}
