import { BoxRenderable, isRenderable, type Renderable } from "@opentui/core";
import type {
  PaneMoveDirection,
  PanePredicate,
  PaneReorderCallback,
  PaneSwapCallback,
} from "./models.js";
import { SplitPaneRenderable } from "./renderables/split-pane.js";

export interface PaneTarget {
  split: SplitPaneRenderable;
  pane: BoxRenderable;
}

export function findPaneTarget(
  start: Renderable | null,
  root: Renderable,
  isPane: PanePredicate,
): PaneTarget | null {
  let target: PaneTarget | null = null;

  for (let node = start; node; node = node.parent) {
    if (node === root) return target;
    if (target || !(node instanceof BoxRenderable)) continue;

    const split = node.parent;
    if (split instanceof SplitPaneRenderable && split.paneList.includes(node) && isPane(node)) {
      target = { split, pane: node };
    }
  }

  return null;
}

function containsSplit(node: Renderable): boolean {
  return node
    .getChildren()
    .some(
      (child) =>
        isRenderable(child) && (child instanceof SplitPaneRenderable || containsSplit(child)),
    );
}

export function isLeafPane(pane: BoxRenderable): boolean {
  return !(pane instanceof SplitPaneRenderable) && !containsSplit(pane);
}

export function collectLeafPanes(root: Renderable, isPane: PanePredicate): BoxRenderable[] {
  const panes: BoxRenderable[] = [];
  const visit = (node: Renderable): void => {
    if (node instanceof SplitPaneRenderable) {
      for (const pane of node.paneList) {
        if (isLeafPane(pane)) {
          if (isPane(pane)) panes.push(pane);
        } else {
          visit(pane);
        }
      }
      return;
    }
    for (const child of node.getChildren()) if (isRenderable(child)) visit(child);
  };
  visit(root);
  return panes;
}

function containsPoint(pane: BoxRenderable, x: number, y: number): boolean {
  return x >= pane.x && x < pane.x + pane.width && y >= pane.y && y < pane.y + pane.height;
}

export function paneTargetAtPoint(
  root: Renderable,
  x: number,
  y: number,
  isPane: PanePredicate,
): PaneTarget | null {
  const visitChildren = (node: Renderable): PaneTarget | null => {
    for (const child of node.getChildren()) {
      if (!(child instanceof BoxRenderable) || !containsPoint(child, x, y)) continue;
      const target = visit(child);
      if (target) return target;
    }
    return null;
  };
  const visit = (node: Renderable): PaneTarget | null => {
    if (node instanceof SplitPaneRenderable) {
      for (const pane of node.paneList) {
        if (!containsPoint(pane, x, y)) continue;
        if (pane instanceof SplitPaneRenderable) return visit(pane);
        return (
          visitChildren(pane) ?? (isPane(pane) && isLeafPane(pane) ? { split: node, pane } : null)
        );
      }
      return null;
    }
    return visitChildren(node);
  };
  return visit(root);
}

function directionScore(
  from: BoxRenderable,
  candidate: BoxRenderable,
  horizontal: boolean,
  sign: -1 | 1,
): number {
  const along = horizontal
    ? candidate.x + candidate.width / 2 - (from.x + from.width / 2)
    : candidate.y + candidate.height / 2 - (from.y + from.height / 2);
  if (Math.sign(along) !== sign) return Infinity;
  const off = horizontal
    ? Math.abs(candidate.y + candidate.height / 2 - (from.y + from.height / 2))
    : Math.abs(candidate.x + candidate.width / 2 - (from.x + from.width / 2));
  return Math.abs(along) + off * 2;
}

// The nearest pane whose center sits in `direction` from `from`.
export function directionalNeighbor(
  from: BoxRenderable,
  candidates: BoxRenderable[],
  direction: PaneMoveDirection,
): BoxRenderable | null {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;

  let best: BoxRenderable | null = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    if (candidate === from) continue;
    const score = directionScore(from, candidate, horizontal, sign);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

export function reorderPane(
  target: PaneTarget,
  to: number,
  onReorder: PaneReorderCallback | undefined,
): boolean {
  const { split, pane } = target;
  const from = split.paneList.indexOf(pane);
  if (!split.movePane(pane, to)) return false;

  onReorder?.(split, from, split.paneList.indexOf(pane));
  return true;
}

// Swap two panes anywhere in the layout, keeping each slot's size.
export function swapPanes(
  a: BoxRenderable,
  b: BoxRenderable,
  onSwap: PaneSwapCallback | undefined,
): boolean {
  const split = a.parent;
  if (!(split instanceof SplitPaneRenderable) || !split.swapWith(a, b)) return false;

  onSwap?.(a, b);
  return true;
}
