#!/usr/bin/env node
/**
 * Generate `@contedra/core/valibot` from the canonical JSON Schemas.
 *
 * Emits one valibot module per JSON Schema file:
 *   - model-definition.schema.json -> model-definition.valibot.ts
 *   - model-manifest.schema.json   -> model-manifest.valibot.ts
 * Cross-file `$ref`s (manifest -> definition by jsdelivr URL) are resolved
 * by importing the previously generated module.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SCHEMA_VERSION = "1.1.0";
const SCHEMAS_DIR = path.resolve(
  REPO_ROOT,
  `packages/core/schemas/${SCHEMA_VERSION}`
);
const OUT_DIR = path.resolve(
  REPO_ROOT,
  `packages/core/generated/${SCHEMA_VERSION}`
);

// Maps external schema $id URLs to the symbol they should be imported as,
// plus the relative module they live in.
const EXTERNAL_REFS = {
  [`https://cdn.jsdelivr.net/npm/@contedra/core/schemas/${SCHEMA_VERSION}/model-definition.schema.json`]:
    {
      symbol: "ModelDefinitionSchema",
      module: "./model-definition.valibot.js",
    },
};

/**
 * Per-target generation config. Each target produces a single .ts file.
 * `defNameMap` covers `#/$defs/<name>` references local to the schema file.
 */
const TARGETS = [
  {
    schemaFile: "model-definition.schema.json",
    outFile: "model-definition.valibot.ts",
    topLevelName: "ModelDefinitionSchema",
    defNameMap: {
      ModelId: "ModelIdSchema",
      ModelName: "ModelNameSchema",
      PropertyName: "PropertyNameSchema",
      SearchPriority: "SearchPrioritySchema",
      FieldElement: "FieldElementSchema",
      MediaType: "MediaTypeSchema",
      Property: "ModelPropertySchema",
      StringProperty: "StringPropertySchema",
      DatetimeProperty: "DatetimePropertySchema",
      RelatedOneProperty: "RelatedOnePropertySchema",
      RelatedManyProperty: "RelatedManyPropertySchema",
      AssetProperty: "AssetPropertySchema",
    },
  },
  {
    schemaFile: "model-manifest.schema.json",
    outFile: "model-manifest.valibot.ts",
    topLevelName: "ModelManifestSchema",
    defNameMap: {},
  },
];

class Generator {
  constructor(schema, defNameMap) {
    this.schema = schema;
    this.defNameMap = defNameMap;
    this.usedValibot = new Set();
    this.usedExternals = new Set();
  }

  emit(node) {
    if (node.$ref !== undefined) return this.emitRef(node.$ref);
    if (node.const !== undefined) {
      this.usedValibot.add("literal");
      return `literal(${JSON.stringify(node.const)})`;
    }
    if (node.enum !== undefined) {
      this.usedValibot.add("picklist");
      return `picklist([${node.enum.map((v) => JSON.stringify(v)).join(", ")}])`;
    }
    if (node.oneOf !== undefined) return this.emitObjectUnion(node.oneOf);
    if (node.anyOf !== undefined) return this.emitObjectUnion(node.anyOf);
    if (node.type === "string") return this.emitString(node);
    if (node.type === "boolean") {
      this.usedValibot.add("boolean");
      return "boolean()";
    }
    if (node.type === "number") {
      this.usedValibot.add("number");
      return "number()";
    }
    if (node.type === "integer") {
      this.usedValibot.add("number");
      this.usedValibot.add("integer");
      this.usedValibot.add("pipe");
      return "pipe(number(), integer())";
    }
    if (node.type === "array") {
      this.usedValibot.add("array");
      const inner = node.items ? this.emit(node.items) : null;
      if (inner) return `array(${inner})`;
      this.usedValibot.add("unknown");
      return "array(unknown())";
    }
    if (node.type === "object") return this.emitObject(node);
    throw new Error(
      `Unsupported schema node: ${JSON.stringify(node).slice(0, 200)}`
    );
  }

  /**
   * If every branch of a oneOf/anyOf is an object (directly or via $ref to a
   * $defs object) and they all use the same `const`-valued discriminator key,
   * emit `variant('<key>', [...])` for sharper error messages. Otherwise fall
   * back to a plain `union([...])`.
   */
  emitObjectUnion(branches) {
    const discriminator = this.findDiscriminator(branches);
    if (discriminator) {
      this.usedValibot.add("variant");
      const parts = branches.map((c) => this.emit(c));
      return `variant(${JSON.stringify(discriminator)}, [${parts.join(", ")}])`;
    }
    this.usedValibot.add("union");
    const parts = branches.map((c) => this.emit(c));
    return `union([${parts.join(", ")}])`;
  }

  findDiscriminator(branches) {
    if (!Array.isArray(branches) || branches.length === 0) return null;
    const candidateKeys = collectConstKeys(this.resolveBranch(branches[0]));
    if (candidateKeys.size === 0) return null;
    for (let i = 1; i < branches.length; i++) {
      const next = collectConstKeys(this.resolveBranch(branches[i]));
      for (const key of [...candidateKeys]) {
        if (!next.has(key)) candidateKeys.delete(key);
      }
      if (candidateKeys.size === 0) return null;
    }
    return [...candidateKeys][0];
  }

  resolveBranch(node) {
    if (!node || typeof node !== "object") return node;
    if (node.$ref) {
      return this.resolveLocalRef(node.$ref) ?? node;
    }
    return node;
  }

  resolveLocalRef(ref) {
    if (!ref.startsWith("#/")) return null;
    const segments = ref.slice(2).split("/");
    let node = this.schema;
    for (const seg of segments) {
      if (!node || typeof node !== "object") return null;
      node = node[seg];
    }
    return node && typeof node === "object" ? node : null;
  }

  emitRef(ref) {
    if (ref.startsWith("#/$defs/")) {
      const name = ref.slice("#/$defs/".length);
      const mapped = this.defNameMap[name];
      if (!mapped) throw new Error(`No name mapping for $defs/${name}`);
      return mapped;
    }
    const external = EXTERNAL_REFS[ref];
    if (external) {
      this.usedExternals.add(external.symbol);
      return external.symbol;
    }
    throw new Error(`Unsupported $ref (no mapping registered): ${ref}`);
  }

  emitString(node) {
    this.usedValibot.add("string");
    const actions = [];
    if (node.minLength !== undefined) {
      if (node.minLength === 1) {
        this.usedValibot.add("nonEmpty");
        actions.push("nonEmpty()");
      } else {
        this.usedValibot.add("minLength");
        actions.push(`minLength(${node.minLength})`);
      }
    }
    if (node.maxLength !== undefined) {
      this.usedValibot.add("maxLength");
      actions.push(`maxLength(${node.maxLength})`);
    }
    if (node.pattern !== undefined) {
      this.usedValibot.add("regex");
      actions.push(`regex(${jsRegex(node.pattern)})`);
    }
    if (actions.length === 0) return "string()";
    this.usedValibot.add("pipe");
    return `pipe(string(), ${actions.join(", ")})`;
  }

  emitObject(node) {
    const ctor = pickObjectCtor(node);
    this.usedValibot.add(ctor);
    const required = new Set(node.required ?? []);
    const props = node.properties ?? {};
    const lines = [];
    for (const [key, child] of Object.entries(props)) {
      const expr = this.emit(child);
      if (required.has(key)) {
        lines.push(`  ${quoteKey(key)}: ${expr},`);
      } else {
        this.usedValibot.add("optional");
        lines.push(`  ${quoteKey(key)}: optional(${expr}),`);
      }
    }
    return `${ctor}({\n${lines.join("\n")}\n})`;
  }
}

function collectConstKeys(node) {
  const keys = new Set();
  if (!node || typeof node !== "object" || node.type !== "object") return keys;
  const props = node.properties ?? {};
  const required = new Set(node.required ?? []);
  for (const [key, value] of Object.entries(props)) {
    if (
      required.has(key) &&
      value &&
      typeof value === "object" &&
      value.const !== undefined
    ) {
      keys.add(key);
    }
  }
  return keys;
}

function pickObjectCtor(node) {
  if (node.additionalProperties === false) return "strictObject";
  if (node.additionalProperties === true) return "looseObject";
  return "object";
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

async function generateTarget(target) {
  const schemaPath = path.join(SCHEMAS_DIR, target.schemaFile);
  const outPath = path.join(OUT_DIR, target.outFile);
  const text = await readFile(schemaPath, "utf-8");
  const schema = JSON.parse(text);

  const gen = new Generator(schema, target.defNameMap);

  const stmts = [];
  const defs = schema.$defs ?? {};
  const order = topoSort(defs);
  for (const name of order) {
    const out = target.defNameMap[name];
    if (!out) throw new Error(`Missing defNameMap entry for ${name}`);
    const expr = gen.emit(defs[name]);
    stmts.push(`export const ${out} = ${expr};`);
  }

  const cleaned = { ...schema };
  delete cleaned.$id;
  delete cleaned.$schema;
  delete cleaned.title;
  delete cleaned.description;
  delete cleaned.$defs;
  const topExpr = gen.emit(cleaned);
  stmts.push(`export const ${target.topLevelName} = ${topExpr};`);

  const valibotImports = [...gen.usedValibot].sort();
  const externalsByModule = new Map();
  for (const symbol of gen.usedExternals) {
    const entry = Object.values(EXTERNAL_REFS).find((e) => e.symbol === symbol);
    if (!entry) continue;
    if (!externalsByModule.has(entry.module)) {
      externalsByModule.set(entry.module, new Set());
    }
    externalsByModule.get(entry.module).add(symbol);
  }

  const lines = [
    `// AUTO-GENERATED FROM ${target.schemaFile} — DO NOT EDIT`,
    "// Regenerate with: pnpm -F @contedra/core generate:valibot",
    "",
    "import {",
    ...valibotImports.map((n) => `  ${n},`),
    `} from "valibot";`,
  ];
  for (const [mod, symbols] of [...externalsByModule.entries()].sort()) {
    lines.push("");
    lines.push("import {");
    for (const symbol of [...symbols].sort()) lines.push(`  ${symbol},`);
    lines.push(`} from "${mod}";`);
  }
  lines.push("", ...stmts, "");

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join("\n"));
  console.log(`Wrote ${path.relative(REPO_ROOT, outPath)}`);
}

async function main() {
  for (const target of TARGETS) {
    await generateTarget(target);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
