import {
  BoxRenderable,
  type CliRenderer,
  MouseButton,
  type MouseEvent,
  type Renderable,
} from "@opentui/core";
import type { PaneDragDrop, PaneDragDropOptions } from "./models.js";
import {
  containsPoint,
  findPaneTarget,
  type PaneTarget,
  paneTargetAtPoint,
  reorderPane,
  swapPanes,
  isVisibleInTree,
} from "./pane-target.js";

// Reorder panes by dragging within a split or across splits to swap places.
export function createPaneDragDrop(
  renderer: CliRenderer,
  options: PaneDragDropOptions = {},
): PaneDragDrop {
  const root = options.root ?? renderer.root;
  const modifier = options.modifier === undefined ? "ctrl" : options.modifier;
  const isPane = options.isPane ?? (() => true);
  const handle = options.handle;
  const cursor = options.cursor === undefined ? "move" : options.cursor;
  const onReorder = options.onReorder;
  const onSwap = options.onSwap;

  let active: PaneTarget | null = null;

  const setCursor = (dragging: boolean): void => {
    if (!cursor) return;
    renderer.setMousePointer(dragging ? cursor : "default");
    renderer.requestRender();
  };

  const modifierHeld = (event: MouseEvent): boolean =>
    !modifier ? true : Boolean(event.modifiers[modifier]);

  const handleAllows = (target: Renderable | null, pane: BoxRenderable): boolean => {
    if (!handle) return true;
    for (let node: Renderable | null = target; node; node = node.parent) {
      if (handle(node, pane)) return true;
      if (node === pane) break;
    }
    return false;
  };

  const dropIndex = (target: PaneTarget, x: number, y: number): number => {
    const panes = target.split.paneList.filter((pane) => pane !== target.pane);
    const horizontal = target.split.direction === "horizontal";
    const coord = horizontal ? x : y;
    let index = 0;
    for (const pane of panes) {
      const mid = horizontal ? pane.x + pane.width / 2 : pane.y + pane.height / 2;
      if (coord < mid) break;
      index++;
    }
    return index;
  };

  const onDown = (event: MouseEvent): void => {
    active = null;
    if (event.button !== MouseButton.LEFT || !modifierHeld(event)) return;
    const grab = findPaneTarget(event.target, root, isPane);
    if (grab && handleAllows(event.target, grab.pane)) {
      active = grab;
      setCursor(true);
    }
  };

  const onDrop = (event: MouseEvent): void => {
    if (!active) return;
    const target = active;
    active = null;
    setCursor(false);
    if (!isVisibleInTree(target.pane) || target.pane.parent !== target.split) return;

    const drop = paneTargetAtPoint(root, event.x, event.y, isPane);
    if (drop) {
      if (drop.split !== target.split) swapPanes(target.pane, drop.pane, onSwap);
      else reorderPane(target, dropIndex(target, event.x, event.y), onReorder);
      return;
    }
    if (containsPoint(target.split, event.x, event.y)) {
      reorderPane(target, dropIndex(target, event.x, event.y), onReorder);
    }
  };

  let disposed = false;
  const processMouseEvent = root.processMouseEvent;
  const listener = function (this: Renderable, event: MouseEvent): void {
    if (!disposed) {
      if (event.type === "down") onDown(event);
      if (event.type === "up" || event.type === "drag-end") onDrop(event);
    }
    processMouseEvent.call(this, event);
  };
  root.processMouseEvent = listener;

  return {
    get dragging() {
      return active !== null;
    },
    dispose: () => {
      disposed = true;
      if (root.processMouseEvent === listener) root.processMouseEvent = processMouseEvent;
      if (active) setCursor(false);
      active = null;
    },
  };
}
