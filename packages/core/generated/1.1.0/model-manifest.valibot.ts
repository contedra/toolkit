// AUTO-GENERATED FROM model-manifest.schema.json — DO NOT EDIT
// Regenerate with: pnpm -F @contedra/core generate:valibot

import {
  array,
  looseObject,
} from "valibot";

import {
  ModelDefinitionSchema,
} from "./model-definition.valibot.js";

export const ModelManifestSchema = looseObject({
  models: array(ModelDefinitionSchema),
});
