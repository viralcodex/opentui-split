import { BoxRenderable, MouseButton, } from "@opentui/core";
import { findPaneTarget, paneTargetAtPoint, reorderPane, swapPanes, } from "./pane-target.js";
// Reorder panes by dragging within a split or across splits to swap places.
export function createPaneDragDrop(renderer, options = {}) {
    const root = options.root ?? renderer.root;
    const modifier = options.modifier === undefined ? "ctrl" : options.modifier;
    const isPane = options.isPane ?? (() => true);
    const handle = options.handle;
    const onReorder = options.onReorder;
    const onSwap = options.onSwap;
    let active = null;
    const modifierHeld = (event) => !modifier ? true : Boolean(event.modifiers[modifier]);
    const handleAllows = (target, pane) => {
        if (!handle)
            return true;
        for (let node = target; node; node = node.parent) {
            if (handle(node, pane))
                return true;
            if (node === pane)
                break;
        }
        return false;
    };
    const dropIndex = (target, x, y) => {
        const panes = target.split.paneList.filter((pane) => pane !== target.pane);
        const horizontal = target.split.direction === "horizontal";
        const coord = horizontal ? x : y;
        let index = 0;
        for (const pane of panes) {
            const mid = horizontal ? pane.x + pane.width / 2 : pane.y + pane.height / 2;
            if (coord < mid)
                break;
            index++;
        }
        return index;
    };
    const containsPoint = (pane, x, y) => x >= pane.x && x < pane.x + pane.width && y >= pane.y && y < pane.y + pane.height;
    const onDown = (event) => {
        active = null;
        if (event.button !== MouseButton.LEFT || !modifierHeld(event))
            return;
        const grab = findPaneTarget(event.target, root, isPane);
        if (grab && handleAllows(event.target, grab.pane))
            active = grab;
    };
    const onDrop = (event) => {
        if (!active)
            return;
        const target = active;
        active = null;
        const drop = paneTargetAtPoint(root, event.x, event.y, isPane);
        if (drop) {
            if (drop.split !== target.split)
                swapPanes(target.pane, drop.pane, onSwap);
            else
                reorderPane(target, dropIndex(target, event.x, event.y), onReorder);
            return;
        }
        if (containsPoint(target.split, event.x, event.y)) {
            reorderPane(target, dropIndex(target, event.x, event.y), onReorder);
        }
    };
    root.onMouse = (event) => {
        if (event.type === "down")
            onDown(event);
        if (event.type === "up" || event.type === "drag-end")
            onDrop(event);
    };
    return {
        get dragging() {
            return active !== null;
        },
        dispose: () => {
            root.onMouse = undefined;
            active = null;
        },
    };
}
//# sourceMappingURL=pane-dragdrop.js.map