#!/usr/bin/env node
/**
 * Generate `@contedra/core/valibot` from `model-definition.schema.json`.
 *
 * Reads the canonical JSON Schema, walks it, and emits a valibot module
 * that can be hand-checked or wired into downstream `safeParse` flows.
 * The generator is intentionally minimal — it covers exactly the schema
 * features that the contedra model schema uses.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.resolve(
  REPO_ROOT,
  "packages/core/schemas/model-definition.schema.json"
);
const OUT_PATH = path.resolve(
  REPO_ROOT,
  "packages/core/generated/model-definition.valibot.ts"
);

// Map JSON Schema $defs name -> emitted const name.
const DEF_NAME_MAP = {
  ModelId: "ModelIdSchema",
  ModelName: "ModelNameSchema",
  PropertyName: "PropertyNameSchema",
  SearchPriority: "SearchPrioritySchema",
  FieldElement: "FieldElementSchema",
  Property: "ModelPropertySchema",
  StringProperty: "StringPropertySchema",
  DatetimeProperty: "DatetimePropertySchema",
  RelatedOneProperty: "RelatedOnePropertySchema",
  RelatedManyProperty: "RelatedManyPropertySchema",
};

const TOP_LEVEL_NAME = "ModelDefinitionSchema";

function emit(node, used) {
  if (node.$ref !== undefined) return emitRef(node.$ref);
  if (node.const !== undefined) {
    used.add("literal");
    return `literal(${JSON.stringify(node.const)})`;
  }
  if (node.enum !== undefined) {
    used.add("picklist");
    return `picklist([${node.enum.map((v) => JSON.stringify(v)).join(", ")}])`;
  }
  if (node.oneOf !== undefined) {
    used.add("union");
    return `union([${node.oneOf.map((c) => emit(c, used)).join(", ")}])`;
  }
  if (node.anyOf !== undefined) {
    used.add("union");
    return `union([${node.anyOf.map((c) => emit(c, used)).join(", ")}])`;
  }
  if (node.type === "string") return emitString(node, used);
  if (node.type === "boolean") {
    used.add("boolean");
    return "boolean()";
  }
  if (node.type === "number") {
    used.add("number");
    return "number()";
  }
  if (node.type === "integer") {
    used.add("number");
    used.add("integer");
    used.add("pipe");
    return "pipe(number(), integer())";
  }
  if (node.type === "array") {
    used.add("array");
    const inner = node.items ? emit(node.items, used) : null;
    if (inner) return `array(${inner})`;
    used.add("unknown");
    return "array(unknown())";
  }
  if (node.type === "object") return emitObject(node, used);
  throw new Error(
    `Unsupported schema node: ${JSON.stringify(node).slice(0, 200)}`
  );
}

function emitRef(ref) {
  if (ref.startsWith("#/$defs/")) {
    const name = ref.slice("#/$defs/".length);
    const mapped = DEF_NAME_MAP[name];
    if (!mapped) throw new Error(`No name mapping for $defs/${name}`);
    return mapped;
  }
  throw new Error(
    `Cross-file $ref is not supported by this generator: ${ref}`
  );
}

function emitString(node, used) {
  used.add("string");
  const actions = [];
  if (node.minLength !== undefined) {
    if (node.minLength === 1) {
      used.add("nonEmpty");
      actions.push("nonEmpty()");
    } else {
      used.add("minLength");
      actions.push(`minLength(${node.minLength})`);
    }
  }
  if (node.maxLength !== undefined) {
    used.add("maxLength");
    actions.push(`maxLength(${node.maxLength})`);
  }
  if (node.pattern !== undefined) {
    used.add("regex");
    actions.push(`regex(${jsRegex(node.pattern)})`);
  }
  if (actions.length === 0) return "string()";
  used.add("pipe");
  return `pipe(string(), ${actions.join(", ")})`;
}

function emitObject(node, used) {
  const isStrict = node.additionalProperties === false;
  const ctor = isStrict ? "strictObject" : "object";
  used.add(ctor);
  const required = new Set(node.required ?? []);
  const props = node.properties ?? {};
  const lines = [];
  for (const [key, child] of Object.entries(props)) {
    const expr = emit(child, used);
    if (required.has(key)) {
      lines.push(`  ${quoteKey(key)}: ${expr},`);
    } else {
      used.add("optional");
      lines.push(`  ${quoteKey(key)}: optional(${expr}),`);
    }
  }
  return `${ctor}({\n${lines.join("\n")}\n})`;
}

function quoteKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function jsRegex(pattern) {
  return `/${pattern.replace(/\//g, "\\/")}/`;
}

function topoSort(defs) {
  const visited = new Set();
  const order = [];
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const deps = collectRefs(defs[name]);
    for (const d of deps) {
      if (defs[d]) visit(d);
    }
    order.push(name);
  }
  for (const name of Object.keys(defs)) visit(name);
  return order;
}

function collectRefs(node, out = new Set()) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, out);
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    if (
      key === "$ref" &&
      typeof value === "string" &&
      value.startsWith("#/$defs/")
    ) {
      out.add(value.slice("#/$defs/".length));
    } else {
      collectRefs(value, out);
    }
  }
  return out;
}

async function main() {
  const text = await readFile(SCHEMA_PATH, "utf-8");
  const schema = JSON.parse(text);

  const used = new Set();
  const defs = schema.$defs ?? {};
  const order = topoSort(defs);

  const stmts = [];
  for (const name of order) {
    const out = DEF_NAME_MAP[name];
    if (!out) throw new Error(`Missing DEF_NAME_MAP for ${name}`);
    const expr = emit(defs[name], used);
    stmts.push(`export const ${out} = ${expr};`);
  }

  const cleaned = { ...schema };
  delete cleaned.$id;
  delete cleaned.$schema;
  delete cleaned.title;
  delete cleaned.description;
  delete cleaned.$defs;
  const topExpr = emit(cleaned, used);
  stmts.push(`export const ${TOP_LEVEL_NAME} = ${topExpr};`);

  const importsList = [...used].sort();

  const lines = [
    "// AUTO-GENERATED FROM model-definition.schema.json — DO NOT EDIT",
    "// Regenerate with: pnpm -F @contedra/core generate:valibot",
    "",
    "import {",
    ...importsList.map((n) => `  ${n},`),
    "} from \"valibot\";",
    "",
    ...stmts,
    "",
  ];

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, lines.join("\n"));
  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
