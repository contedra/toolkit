#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corePkgPath = path.resolve(__dirname, "../packages/core/package.json");
const corePkg = JSON.parse(await readFile(corePkgPath, "utf-8"));
const version = corePkg.version;

if (!version || /PLACEHOLDER/i.test(version)) {
  throw new Error(`@contedra/core has invalid version "${version}"`);
}

const schemasDir = path.resolve(__dirname, "../packages/core/schemas");
const entries = await readdir(schemasDir);

let rewritten = 0;
for (const entry of entries) {
  if (!entry.endsWith(".schema.json")) continue;
  const filePath = path.join(schemasDir, entry);
  const original = await readFile(filePath, "utf-8");
  const updated = original.replace(
    /(@contedra\/core@)[^/"]+(\/schemas\/)/g,
    `$1${version}$2`
  );
  if (updated !== original) {
    await writeFile(filePath, updated);
    rewritten++;
    console.log(`rewrote $id in ${entry} -> @contedra/core@${version}`);
  }
}

if (rewritten === 0) {
  console.log(`no schema $id to rewrite (version already ${version})`);
}
