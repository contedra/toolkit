// AUTO-GENERATED FROM model-definition.schema.json — DO NOT EDIT
// Regenerate with: pnpm -F @contedra/core generate:valibot

import {
  array,
  boolean,
  literal,
  maxLength,
  minLength,
  nonEmpty,
  number,
  optional,
  picklist,
  pipe,
  regex,
  strictObject,
  string,
  variant,
} from "valibot";

export const ModelIdSchema = pipe(string(), nonEmpty(), maxLength(128), regex(/^[a-zA-Z0-9_-]+$/));
export const ModelNameSchema = pipe(string(), minLength(3), maxLength(64), regex(/^[a-z][a-z0-9_]*$/));
export const PropertyNameSchema = pipe(string(), nonEmpty());
export const SearchPrioritySchema = picklist(["high", "normal", "low", "none"]);
export const FieldElementSchema = picklist(["input", "textarea", "markdown", "select"]);
export const StringPropertySchema = strictObject({
  propertyName: PropertyNameSchema,
  dataType: literal("string"),
  fieldType: strictObject({
  element: FieldElementSchema,
}),
  require: optional(boolean()),
  min: optional(number()),
  max: optional(number()),
  regex: optional(string()),
  defaultValue: optional(string()),
  searchPriority: optional(SearchPrioritySchema),
});
export const DatetimePropertySchema = strictObject({
  propertyName: PropertyNameSchema,
  dataType: literal("datetime"),
  require: optional(boolean()),
  defaultValue: optional(string()),
  onUpdate: optional(string()),
});
export const RelatedOnePropertySchema = strictObject({
  propertyName: PropertyNameSchema,
  dataType: literal("relatedOne"),
  relatedModel: ModelIdSchema,
  require: optional(boolean()),
  defaultValue: optional(string()),
});
export const RelatedManyPropertySchema = strictObject({
  propertyName: PropertyNameSchema,
  dataType: literal("relatedMany"),
  relatedModel: ModelIdSchema,
  require: optional(boolean()),
  defaultValue: optional(string()),
});
export const ModelPropertySchema = variant("dataType", [StringPropertySchema, DatetimePropertySchema, RelatedOnePropertySchema, RelatedManyPropertySchema]);
export const ModelDefinitionSchema = strictObject({
  id: ModelIdSchema,
  modelName: ModelNameSchema,
  properties: array(ModelPropertySchema),
});
