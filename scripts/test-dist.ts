#!/usr/bin/env bun
// Smoke-test the compiled package through its public entry points.
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
  "dist/pane-navigator.js",
  "dist/pane-navigator.d.ts",
  "dist/pane-dragdrop.js",
  "dist/pane-dragdrop.d.ts",
  "dist/pane-movement.js",
  "dist/pane-movement.d.ts",
  "dist/pane-reorder.js",
  "dist/pane-reorder.d.ts",
  "dist/renderables/split-pane.js",
  "dist/renderables/split-pane.d.ts",
  "dist/renderables/gutter.js",
  "dist/renderables/gutter.d.ts",
];

const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) {
  throw new Error(`dist is missing expected files: ${missing.join(", ")}`);
}

const mod = (await import(resolve(root, "dist/index.js"))) as Record<string, unknown>;
const expectedExports = [
  "SplitPaneRenderable",
  "GutterRenderable",
  "createPaneNavigator",
  "createPaneDragDrop",
  "createPaneMovement",
  "createPaneReorder",
];
const absent = expectedExports.filter((name) => typeof mod[name] !== "function");
if (absent.length > 0) {
  throw new Error(`dist/index.js is missing exports: ${absent.join(", ")}`);
}

for (const adapter of ["react", "solid"]) {
  const entry = (await import(resolve(root, `dist/${adapter}.js`))) as Record<string, unknown>;
  if (typeof entry.registerSplitPane !== "function") {
    throw new Error(`dist/${adapter}.js is missing export: registerSplitPane`);
  }
  if (typeof entry.SplitPaneRenderable !== "function") {
    throw new Error(`dist/${adapter}.js should re-export SplitPaneRenderable`);
  }
}

interface DistSplitPane extends BoxRenderable {
  direction: "horizontal" | "vertical";
  sizes: number[];
  addPane(pane: BoxRenderable, size?: number, minSize?: number): void;
  setGutterVisible(visible: boolean): void;
  movePane(pane: BoxRenderable, toIndex: number): boolean;
  readonly paneList: BoxRenderable[];
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

  const createPaneNavigator = mod.createPaneNavigator as (
    renderer: typeof setup.renderer,
    options?: { keymap?: false },
  ) => { focusNext(): void; current: BoxRenderable | null };
  first.focusable = true;
  second.focusable = true;
  const navigator = createPaneNavigator(setup.renderer, { keymap: false });
  navigator.focusNext();
  if (navigator.current !== first) {
    throw new Error("dist pane navigator did not focus the first pane");
  }

  split.direction = "horizontal";
  await setup.renderOnce();
  if (!split.movePane(first, 1) || split.paneList[1] !== first) {
    throw new Error("dist split pane did not reorder via movePane");
  }

  const createPaneMovement = mod.createPaneMovement as (renderer: typeof setup.renderer) => {
    move(direction: "left" | "right" | "up" | "down"): boolean;
    dispose(): void;
  };
  first.focus();
  const movement = createPaneMovement(setup.renderer);
  if (!movement.move("left") || split.paneList[0] !== first) {
    throw new Error("dist createPaneMovement did not move the focused pane");
  }
  movement.dispose();
} finally {
  setup.renderer.destroy();
}

console.log(
  `dist behavior OK (${expectedExports.join(", ")}, gutter visibility, direction updates, pane navigation, pane reorder, react/solid adapters)`,
);
