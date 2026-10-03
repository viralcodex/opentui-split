#!/usr/bin/env bun
/**
 * Smoke-tests the built `dist/` output the way a published consumer would:
 * it imports from the compiled entry point (not `src/`) and asserts the public
 * API and its type declarations are present. Run after `build`, before publish.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BoxRenderable, type BoxOptions, type RenderContext } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const required = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/react.js",
  "dist/react.d.ts",
  "dist/solid.js",
  "dist/solid.d.ts",
  "dist/renderables/split-pane.js",
  "dist/renderables/split-pane.d.ts",
  "dist/renderables/gutter.js",
  "dist/renderables/gutter.d.ts",
];

const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) {
  console.error("dist is missing expected files:");
  for (const file of missing) console.error(`  - ${file}`);
  process.exit(1);
}

const mod = (await import(resolve(root, "dist/index.js"))) as Record<string, unknown>;
const expectedExports = ["SplitPaneRenderable", "GutterRenderable"];
const absent = expectedExports.filter((name) => typeof mod[name] !== "function");
if (absent.length > 0) {
  console.error(`dist/index.js is missing exports: ${absent.join(", ")}`);
  process.exit(1);
}

for (const adapter of ["react", "solid"]) {
  const entry = (await import(resolve(root, `dist/${adapter}.js`))) as Record<string, unknown>;
  if (typeof entry.registerSplitPane !== "function") {
    console.error(`dist/${adapter}.js is missing export: registerSplitPane`);
    process.exit(1);
  }
  if (typeof entry.SplitPaneRenderable !== "function") {
    console.error(`dist/${adapter}.js should re-export SplitPaneRenderable`);
    process.exit(1);
  }
}

interface DistSplitPane extends BoxRenderable {
  direction: "horizontal" | "vertical";
  sizes: number[];
  addPane(pane: BoxRenderable, size?: number, minSize?: number): void;
  setGutterVisible(visible: boolean): void;
}

type DistSplitPaneConstructor = new (
  ctx: RenderContext,
  options: BoxOptions & { direction?: "horizontal" | "vertical" },
) => DistSplitPane;

const SplitPane = mod.SplitPaneRenderable as DistSplitPaneConstructor;
const setup = await createTestRenderer({ width: 40, height: 10 });
try {
  const split = new SplitPane(setup.renderer, { id: "dist-split", width: 40, height: 10 });
  const first = new BoxRenderable(setup.renderer, { id: "first" });
  const second = new BoxRenderable(setup.renderer, { id: "second" });
  split.addPane(first, 15, 4);
  split.addPane(second, 24, 4);
  setup.renderer.root.add(split);
  await setup.renderOnce();

  const gutter = split.getChildren()[1] as BoxRenderable & { showHairline?: boolean };
  if (split.getChildrenCount() !== 3 || gutter.showHairline !== true) {
    throw new Error("dist split pane did not create a visible gutter between two panes");
  }

  split.setGutterVisible(false);
  if (gutter.showHairline) {
    throw new Error("dist split pane did not update gutter visibility");
  }

  split.direction = "vertical";
  split.sizes = [3, 6];
  await setup.renderOnce();
  if (first.width !== 40 || first.height !== 3) {
    throw new Error(`dist split pane direction update produced ${first.width}x${first.height}`);
  }
} finally {
  setup.renderer.destroy();
}

console.log(
  `dist behavior OK (${expectedExports.join(", ")}, gutter visibility, direction updates, react/solid adapters)`,
);
