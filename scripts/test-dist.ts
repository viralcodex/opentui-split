#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { BoxRenderable } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import pkg from "../package.json" with { type: "json" };
import type * as Source from "../src/index.js";

const root = new URL("../", import.meta.url);
for (const entry of Object.values(pkg.exports)) {
  for (const file of Object.values(entry)) {
    if (!existsSync(new URL(file, root))) {
      throw new Error(`Missing package export: ${file}`);
    }
  }
}

const mod = (await import(new URL(pkg.exports["."].import, root).href)) as typeof Source;
const expectedExports = [
  "SplitPaneRenderable",
  "GutterRenderable",
  "createPaneNavigator",
  "createPaneDragDrop",
  "createPaneMovement",
  "createPaneReorder",
  "captureLayout",
  "restoreLayout",
] satisfies Array<keyof typeof Source>;
for (const name of expectedExports) {
  if (typeof mod[name] !== "function") {
    throw new Error(`Compiled package is missing export: ${name}`);
  }
}

for (const adapter of ["./react", "./solid"] as const) {
  const entry = await import(new URL(pkg.exports[adapter].import, root).href);
  if (
    typeof entry.registerSplitPane !== "function" ||
    entry.SplitPaneRenderable !== mod.SplitPaneRenderable
  ) {
    throw new Error(`Invalid package adapter: ${adapter}`);
  }
}

const setup = await createTestRenderer({ width: 40, height: 10 });
try {
  const split = new mod.SplitPaneRenderable(setup.renderer, { width: 40, height: 10 });
  const first = new BoxRenderable(setup.renderer, { id: "first" });
  const second = new BoxRenderable(setup.renderer, { id: "second" });
  split.addPane(first, 15);
  split.addPane(second, 24);
  setup.renderer.root.add(split);
  await setup.renderOnce();

  if (split.getChildrenCount() !== 3 || first.width !== 15 || second.width !== 24) {
    throw new Error("Compiled split pane did not render two panes and a gutter");
  }
} finally {
  setup.renderer.destroy();
}

console.log("Compiled exports, adapters, and rendering OK");
