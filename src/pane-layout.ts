import { BoxRenderable, type RenderContext } from "@opentui/core";
import type { LayoutNode, SplitPaneOptions } from "./models.js";
import { normalizeWeights } from "./pane-sizing.js";
import { SplitPaneRenderable } from "./renderables/split-pane.js";

class RestoredSplitPane extends SplitPaneRenderable {
  constructor(ctx: RenderContext, options: SplitPaneOptions, weights: number[]) {
    super(ctx, { ...options, sizes: normalizeWeights(weights) });
    this.initialSizesAreWeights = true;
  }
}

function validateWeights(weights: unknown, count: number): void {
  if (!Array.isArray(weights) || weights.length !== count) {
    throw new TypeError("Layout splits require one weight per child");
  }
  for (const weight of weights) {
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      throw new TypeError("Layout weights must be finite, non-negative numbers");
    }
  }
}

function splitChildren(node: object): unknown[] {
  if (
    !("direction" in node) ||
    (node.direction !== "horizontal" && node.direction !== "vertical") ||
    !("children" in node) ||
    !Array.isArray(node.children)
  ) {
    throw new TypeError("Layout splits require a direction and children array");
  }
  validateWeights("weights" in node ? node.weights : undefined, node.children.length);
  return node.children;
}

function validateLayout(value: unknown): asserts value is LayoutNode {
  const seen = new Set<unknown>();
  const ids = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object" || seen.has(node)) {
      throw new TypeError("Layout must be a tree of pane and split objects");
    }
    seen.add(node);
    if ("paneId" in node) {
      if (typeof node.paneId !== "string" || !node.paneId || ids.has(node.paneId)) {
        throw new TypeError("Layout pane IDs must be non-empty and unique");
      }
      ids.add(node.paneId);
      return;
    }
    for (const child of splitChildren(node)) visit(child);
  };
  visit(value);
}

export function captureLayout(pane: BoxRenderable): LayoutNode {
  const capture = (node: BoxRenderable): LayoutNode => {
    if (node.isDestroyed) throw new TypeError("Cannot capture a destroyed pane");
    if (!(node instanceof SplitPaneRenderable)) return { paneId: node.id };
    return {
      direction: node.direction,
      weights: node.layoutWeights,
      children: node.paneList.map(capture),
    };
  };
  const layout = capture(pane);
  validateLayout(layout);
  return layout;
}

export function restoreLayout(
  ctx: RenderContext,
  layout: unknown,
  resolvePane: (paneId: string) => BoxRenderable,
  options: SplitPaneOptions = {},
): BoxRenderable {
  validateLayout(layout);
  const panes = new Map<string, BoxRenderable>();
  const created: BoxRenderable[] = [];
  const resolve = (node: LayoutNode): void => {
    if ("paneId" in node) {
      const pane = resolvePane(node.paneId);
      if (
        !(pane instanceof BoxRenderable) ||
        pane instanceof SplitPaneRenderable ||
        pane.isDestroyed ||
        pane.parent ||
        pane.id !== node.paneId
      ) {
        throw new TypeError(
          `resolvePane must return a fresh, unattached box with ID "${node.paneId}"`,
        );
      }
      created.push(pane);
      panes.set(node.paneId, pane);
    } else {
      node.children.forEach(resolve);
    }
  };
  const build = (node: LayoutNode, splitOptions: SplitPaneOptions): BoxRenderable => {
    if ("paneId" in node) return panes.get(node.paneId)!;
    const split = new RestoredSplitPane(
      ctx,
      { ...splitOptions, direction: node.direction },
      node.weights,
    );
    created.push(split);
    for (const child of node.children) split.addPane(build(child, {}));
    return split;
  };
  try {
    resolve(layout);
    return build(layout, options);
  } catch (error) {
    for (const pane of created.toReversed()) {
      if (!pane.isDestroyed) pane.destroyRecursively();
    }
    throw error;
  }
}
