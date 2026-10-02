import type {} from "@opentui/solid";
import { LayoutSlotRenderable } from "@opentui/solid";
import { extend } from "@opentui/solid/components";
import type { BaseRenderable } from "@opentui/core";
import { SplitPaneRenderable } from "./index.js";

class SolidSplitPaneRenderable extends SplitPaneRenderable {
  protected override isAuxiliaryChild(obj: unknown): obj is BaseRenderable {
    return obj instanceof LayoutSlotRenderable;
  }
}

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    split_pane: typeof SplitPaneRenderable;
  }
}

let registered = false;

export function registerSplitPane(): void {
  if (registered) return;
  registered = true;
  extend({ split_pane: SolidSplitPaneRenderable });
}

registerSplitPane();

export * from "./index.js";
