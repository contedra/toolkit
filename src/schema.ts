import { z, type ZodTypeAny } from "astro/zod";
import type { ModelProperty } from "./types.js";

export function dataTypeToZod(property: ModelProperty): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (property.dataType) {
    case "string":
      schema = z.string();
      break;
    case "datetime":
      schema = z.coerce.date();
      break;
    case "relatedOne":
      schema = z.string();
      break;
    case "relatedMany":
      schema = z.array(z.string());
      break;
    default:
      schema = z.unknown();
  }

  if (!property.require) {
    schema = schema.optional();
  }

  return schema;
}

export function buildSchema(
  properties: ModelProperty[],
  bodyField?: string
): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const prop of properties) {
    if (prop.propertyName === bodyField) continue;
    shape[prop.propertyName] = dataTypeToZod(prop);
  }

  return z.object(shape);
}
