import { readFile } from "node:fs/promises";
import type { ModelDefinition, ModelFile, ModelManifest } from "./types.js";

function isModelManifest(value: unknown): value is ModelManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { models?: unknown }).models)
  );
}

function isModelDefinition(value: unknown): value is ModelDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<ModelDefinition>;
  return (
    typeof candidate.modelName === "string" &&
    Array.isArray(candidate.properties)
  );
}

export async function loadModel(
  filePath: string,
  modelName?: string
): Promise<ModelDefinition> {
  const raw = await readFile(filePath, "utf-8");
  return resolveModelFromString(raw, filePath, modelName);
}

export function resolveModel(
  parsed: unknown,
  filePath: string,
  modelName?: string
): ModelDefinition {
  if (Array.isArray(parsed)) {
    throw new Error(
      `Invalid model file "${filePath}": bare array format is not supported. ` +
        `Wrap it in { "models": [...] } (ModelManifest) or use a single ModelDefinition object.`
    );
  }

  const file = parsed as ModelFile;

  if (isModelManifest(file)) {
    return resolveFromManifest(filePath, file, modelName);
  }

  if (isModelDefinition(file)) {
    return resolveFromSingle(filePath, file, modelName);
  }

  throw new Error(
    `Invalid model file "${filePath}": expected a ModelDefinition object ` +
      `({ id, modelName, properties }) or a ModelManifest object ({ models: [...] }).`
  );
}

function resolveModelFromString(
  raw: string,
  filePath: string,
  modelName: string | undefined
): ModelDefinition {
  const parsed: unknown = JSON.parse(raw);
  return resolveModel(parsed, filePath, modelName);
}

function resolveFromSingle(
  filePath: string,
  model: ModelDefinition,
  modelName: string | undefined
): ModelDefinition {
  if (modelName !== undefined && model.modelName !== modelName) {
    throw new Error(
      `Model file "${filePath}" defines model "${model.modelName}", ` +
        `but modelName "${modelName}" was requested.`
    );
  }
  return model;
}

function resolveFromManifest(
  filePath: string,
  manifest: ModelManifest,
  modelName: string | undefined
): ModelDefinition {
  const models = manifest.models;

  if (models.length === 0) {
    throw new Error(
      `Invalid model manifest "${filePath}": "models" array is empty.`
    );
  }

  if (!models.every(isModelDefinition)) {
    throw new Error(
      `Invalid model manifest "${filePath}": every entry under "models" ` +
        `must include "modelName" and "properties".`
    );
  }

  if (modelName === undefined) {
    const names = models.map((m) => m.modelName).join(", ");
    throw new Error(
      `Model file "${filePath}" is a ModelManifest containing multiple models ` +
        `(${names}). Pass a modelName to disambiguate.`
    );
  }

  const matches = models.filter((m) => m.modelName === modelName);

  if (matches.length === 0) {
    const available = models.map((m) => m.modelName).join(", ");
    throw new Error(
      `Model "${modelName}" not found in "${filePath}". ` +
        `Available models: ${available || "(none)"}.`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Model "${modelName}" appears ${matches.length} times in "${filePath}". ` +
        `Each modelName must be unique within a manifest.`
    );
  }

  return matches[0];
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
