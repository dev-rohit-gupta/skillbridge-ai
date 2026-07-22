import {
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const roots = [
  "apps/api/src",
  "apps/api/tests",
];

const supportedRuntimeExtensions = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".node",
]);

function addJsExtension(specifier) {
  const extension = path.posix.extname(specifier);

  if (supportedRuntimeExtensions.has(extension)) {
    return specifier;
  }

  return `${specifier}.js`;
}

async function visit(directory) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await visit(fullPath);
      continue;
    }

    if (!/\.(ts|tsx|mts|cts)$/.test(entry.name)) {
      continue;
    }

    const current = await readFile(fullPath, "utf8");

    const updated = current
      .replace(
        /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
        (_match, prefix, specifier, suffix) =>
          `${prefix}${addJsExtension(specifier)}${suffix}`,
      )
      .replace(
        /(import\s*\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g,
        (_match, prefix, specifier, suffix) =>
          `${prefix}${addJsExtension(specifier)}${suffix}`,
      );

    if (updated !== current) {
      await writeFile(fullPath, updated);
      console.log(`Updated ${fullPath}`);
    }
  }
}

for (const root of roots) {
  await visit(root);
}