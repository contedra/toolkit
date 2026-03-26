import { readFileSync } from "node:fs";
import type { Loader } from "astro/loaders";
import { loadModel, detectBodyField } from "./model.js";
import { buildSchema } from "./schema.js";
import { initFirestore, fetchDocuments, transformDocumentData } from "./firestore.js";
import type { ContedraLoaderConfig } from "./types.js";

export function contedraLoader(config: ContedraLoaderConfig): Loader {
  return {
    name: "contedra-firestore",

    async load(context) {
      const model = await loadModel(config.modelFile);
      const bodyField = detectBodyField(model, config.bodyField);
      const collectionName = config.collection ?? model.modelName;

      const firestore = initFirestore(config.firebaseConfig);
      const documents = await fetchDocuments(firestore, collectionName);

      context.store.clear();

      for (const doc of documents) {
        const { data, body } = transformDocumentData(
          doc.data,
          model,
          bodyField
        );

        const parsed = await context.parseData({ id: doc.id, data });

        const rendered = body ? await context.renderMarkdown(body) : undefined;

        context.store.set({
          id: doc.id,
          data: parsed,
          body,
          rendered,
        });
      }
    },

    schema() {
      const raw = readFileSync(config.modelFile, "utf-8");
      const model = JSON.parse(raw);
      const bodyField = detectBodyField(model, config.bodyField);
      return buildSchema(model.properties, bodyField);
    },
  };
}
