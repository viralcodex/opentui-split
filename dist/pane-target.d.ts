import { BoxRenderable, type Renderable } from "@opentui/core";
import type { PaneMoveDirection, PanePredicate, PaneReorderCallback, PaneSwapCallback } from "./models.js";
import { SplitPaneRenderable } from "./renderables/split-pane.js";
export interface PaneTarget {
    split: SplitPaneRenderable;
    pane: BoxRenderable;
}
export declare function findPaneTarget(start: Renderable | null, root: Renderable, isPane: PanePredicate): PaneTarget | null;
export declare function isLeafPane(pane: BoxRenderable): boolean;
export declare function collectLeafPanes(root: Renderable, isPane: PanePredicate): BoxRenderable[];
export declare function paneTargetAtPoint(root: Renderable, x: number, y: number, isPane: PanePredicate): PaneTarget | null;
export declare function directionalNeighbor(from: BoxRenderable, candidates: BoxRenderable[], direction: PaneMoveDirection): BoxRenderable | null;
export declare function reorderPane(target: PaneTarget, to: number, onReorder: PaneReorderCallback | undefined): boolean;
export declare function swapPanes(a: BoxRenderable, b: BoxRenderable, onSwap: PaneSwapCallback | undefined): boolean;
