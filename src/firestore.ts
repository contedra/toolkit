import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { ContedraLoaderConfig, ModelDefinition } from "./types.js";

export function initFirestore(config: ContedraLoaderConfig["firebaseConfig"]) {
  const appName = `contedra-${config.projectId}`;
  const existingApp = getApps().find((app) => app.name === appName);

  const app =
    existingApp ??
    initializeApp(
      {
        projectId: config.projectId,
        ...(config.credential ? { credential: cert(config.credential) } : {}),
      },
      appName
    );

  return getFirestore(app);
}

export async function fetchDocuments(
  firestore: FirebaseFirestore.Firestore,
  collectionName: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const snapshot = await firestore.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));
}

export function transformDocumentData(
  data: Record<string, unknown>,
  model: ModelDefinition,
  bodyField?: string
): { data: Record<string, unknown>; body?: string } {
  const result: Record<string, unknown> = {};
  let body: string | undefined;

  for (const prop of model.properties) {
    const value = data[prop.propertyName];

    if (prop.propertyName === bodyField) {
      body = value != null ? String(value) : undefined;
      continue;
    }

    result[prop.propertyName] = convertValue(value, prop.dataType);
  }

  return { data: result, body };
}

function convertValue(
  value: unknown,
  dataType: string
): unknown {
  if (value == null) return undefined;

  switch (dataType) {
    case "datetime":
      if (value instanceof Timestamp) {
        return value.toDate();
      }
      return value;
    case "relatedOne":
      if (typeof value === "object" && value !== null && "id" in value) {
        return (value as { id: string }).id;
      }
      return String(value);
    case "relatedMany":
      if (Array.isArray(value)) {
        return value.map((v) => {
          if (typeof v === "object" && v !== null && "id" in v) {
            return (v as { id: string }).id;
          }
          return String(v);
        });
      }
      return [];
    default:
      return value;
  }
}
