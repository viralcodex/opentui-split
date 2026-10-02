#!/usr/bin/env bun
/**
 * Smoke-tests the built `dist/` output the way a published consumer would:
 * it imports from the compiled entry point (not `src/`) and asserts the public
 * API and its type declarations are present. Run after `build`, before publish.
 */
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")

const required = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/renderables/split-pane.js",
  "dist/renderables/split-pane.d.ts",
  "dist/renderables/gutter.js",
  "dist/renderables/gutter.d.ts",
]

const missing = required.filter((file) => !existsSync(resolve(root, file)))
if (missing.length > 0) {
  console.error("✗ dist is missing expected files:")
  for (const file of missing) console.error(`  - ${file}`)
  process.exit(1)
}

const mod = (await import(resolve(root, "dist/index.js"))) as Record<string, unknown>
const expectedExports = ["SplitPaneRenderable", "GutterRenderable"]
const absent = expectedExports.filter((name) => typeof mod[name] !== "function")
if (absent.length > 0) {
  console.error(`✗ dist/index.js is missing exports: ${absent.join(", ")}`)
  process.exit(1)
}

console.log(`✓ dist exports OK (${expectedExports.join(", ")})`)
