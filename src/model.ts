import { readFile } from "node:fs/promises";
import type { ModelDefinition } from "./types.js";

export async function loadModel(filePath: string): Promise<ModelDefinition> {
  const raw = await readFile(filePath, "utf-8");
  const model: ModelDefinition = JSON.parse(raw);

  if (!model.modelName || !Array.isArray(model.properties)) {
    throw new Error(
      `Invalid model definition: must have "modelName" and "properties"`
    );
  }

  return model;
}

export function detectBodyField(
  model: ModelDefinition,
  explicitBodyField?: string
): string | undefined {
  if (explicitBodyField) {
    const prop = model.properties.find(
      (p) => p.propertyName === explicitBodyField
    );
    if (!prop) {
      throw new Error(
        `bodyField "${explicitBodyField}" not found in model "${model.modelName}"`
      );
    }
    return explicitBodyField;
  }

  const markdownProp = model.properties.find(
    (p) => p.fieldType?.element === "markdown"
  );
  return markdownProp?.propertyName;
}
