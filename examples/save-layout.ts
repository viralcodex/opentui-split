import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BoxRenderable, type CliRenderer, createCliRenderer, TextRenderable } from "@opentui/core";
import { captureLayout, type LayoutNode, restoreLayout } from "../src/index.ts";
import { bindKeys, bindPaneControls, isModifiedKey } from "./pane-layout.ts";

const initialLayout: LayoutNode = {
  direction: "horizontal",
  weights: [1, 3],
  children: [
    { paneId: "files" },
    {
      direction: "vertical",
      weights: [2, 1],
      children: [{ paneId: "editor" }, { paneId: "output" }],
    },
  ],
};

export function run(renderer: CliRenderer, layoutPath: string): () => void {
  const root = new BoxRenderable(renderer, {
    id: "save-layout-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
  });
  const stage = new BoxRenderable(renderer, {
    id: "save-layout-stage",
    width: "100%",
    flexGrow: 1,
  });
  const status = new TextRenderable(renderer, {
    id: "save-layout-status",
    height: 1,
    content: layoutPath,
  });
  root.add(stage);
  root.add(status);
  renderer.root.add(root);

  const createPane = (id: string): BoxRenderable => {
    const pane = new BoxRenderable(renderer, {
      id,
      border: true,
      borderColor: "#64748b",
      focusedBorderColor: "#22c55e",
      focusable: true,
      alignItems: "center",
      justifyContent: "center",
    });
    pane.add(new TextRenderable(renderer, { content: id }));
    return pane;
  };

  const build = (data: unknown): BoxRenderable =>
    restoreLayout(renderer, data, createPane, { width: "100%", height: "100%" });
  let layout = build(initialLayout);
  stage.add(layout);

  const replace = (data: unknown): void => {
    const next = build(data);
    layout.destroyRecursively();
    layout = next;
    stage.add(layout);
  };
  const actions: Record<string, () => void> = {
    s: () => {
      mkdirSync(dirname(layoutPath), { recursive: true });
      writeFileSync(layoutPath, JSON.stringify(captureLayout(layout), null, 2));
      status.content = `Saved ${layoutPath}`;
    },
    l: () => {
      replace(JSON.parse(readFileSync(layoutPath, "utf8")));
      status.content = `Loaded ${layoutPath}`;
    },
    r: () => {
      replace(initialLayout);
      status.content = "Reset";
    },
  };
  const unbindControls = bindPaneControls(renderer, { root: stage });
  const unbindKeys = bindKeys(renderer, (key) => {
    if (isModifiedKey(key)) return;
    try {
      actions[key.name]?.();
    } catch (error) {
      status.content = error instanceof Error ? error.message : String(error);
    }
  });
  renderer.start();
  return () => {
    unbindKeys();
    unbindControls();
    root.destroyRecursively();
  };
}

if (import.meta.main) {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  const defaultPath = resolve(dirname(fileURLToPath(import.meta.url)), "assets/layout.json");
  const dispose = run(renderer, process.argv[2] ? resolve(process.argv[2]) : defaultPath);
  renderer.once("destroy", dispose);
}
