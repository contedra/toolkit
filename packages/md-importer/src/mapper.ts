import type { ModelDefinition, ModelProperty } from "@contedra/core";

export interface MappedFields {
  data: Record<string, unknown>;
  unmapped: string[];
}

/**
 * Map frontmatter fields to model properties.
 * 1. Apply explicit fieldMapping (frontmatter key -> model property name)
 * 2. Auto-match remaining frontmatter keys by name equality with model properties
 */
export function mapFields(
  frontmatter: Record<string, unknown>,
  model: ModelDefinition,
  fieldMapping?: Record<string, string>
): MappedFields {
  const data: Record<string, unknown> = {};
  const unmapped: string[] = [];

  const propertyNames = new Set(
    model.properties.map((p) => p.propertyName)
  );

  const resolvedMapping = new Map<string, string>();

  // Build explicit mapping
  if (fieldMapping) {
    for (const [fmKey, propName] of Object.entries(fieldMapping)) {
      resolvedMapping.set(fmKey, propName);
    }
  }

  // Auto-match remaining keys
  for (const fmKey of Object.keys(frontmatter)) {
    if (!resolvedMapping.has(fmKey) && propertyNames.has(fmKey)) {
      resolvedMapping.set(fmKey, fmKey);
    }
  }

  for (const [fmKey, propName] of resolvedMapping) {
    if (fmKey in frontmatter && propertyNames.has(propName)) {
      const prop = model.properties.find(
        (p) => p.propertyName === propName
      ) as ModelProperty;
      data[propName] = coerceValue(frontmatter[fmKey], prop);
    }
  }

  // Identify unmapped frontmatter keys
  for (const fmKey of Object.keys(frontmatter)) {
    if (!resolvedMapping.has(fmKey)) {
      unmapped.push(fmKey);
    }
  }

  return { data, unmapped };
}

function coerceValue(value: unknown, prop: ModelProperty): unknown {
  if (value == null) return undefined;

  switch (prop.dataType) {
    case "datetime":
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") {
        return new Date(value);
      }
      return value;
    case "relatedMany":
      if (Array.isArray(value)) return value.map(String);
      return [String(value)];
    case "relatedOne":
      return String(value);
    default:
      return value;
  }
}
