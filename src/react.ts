import { extend } from "@opentui/react";
import { SplitPaneRenderable } from "./index.js";

declare module "@opentui/react" {
  interface OpenTUIComponents {
    "split-pane": typeof SplitPaneRenderable;
  }
}

let registered = false;

export function registerSplitPane(): void {
  if (registered) return;
  registered = true;
  extend({ "split-pane": SplitPaneRenderable });
}

registerSplitPane();

export * from "./index.js";
