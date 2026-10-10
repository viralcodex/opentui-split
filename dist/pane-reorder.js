import { collectLeafPanes, directionalNeighbor, findPaneTarget, reorderPane, swapPanes, } from "./pane-target.js";
const KeyDirections = {
    left: "left",
    right: "right",
    up: "up",
    down: "down",
    b: "left",
    f: "right",
};
const AxisMoves = {
    horizontal: { left: -1, right: 1 },
    vertical: { up: -1, down: 1 },
};
function defaultKeymap(event) {
    if (event.ctrl || (!event.option && !event.meta))
        return;
    return KeyDirections[event.name];
}
// Move the focused pane within or across splits.
export function createPaneReorder(renderer, options = {}) {
    const root = options.root ?? renderer.root;
    const isPane = options.isPane ?? (() => true);
    const onReorder = options.onReorder;
    const onSwap = options.onSwap;
    const slotWithinSplit = (target, direction) => {
        const delta = AxisMoves[target.split.direction][direction];
        if (!delta)
            return null;
        const panes = target.split.paneList;
        const to = panes.indexOf(target.pane) + delta;
        return to >= 0 && to < panes.length ? to : null;
    };
    const move = (direction) => {
        const focused = renderer.currentFocusedRenderable;
        const target = findPaneTarget(focused, root, isPane);
        if (!target)
            return false;
        const slot = slotWithinSplit(target, direction);
        const moved = slot !== null
            ? reorderPane(target, slot, onReorder)
            : swapWithNeighbor(target.pane, direction);
        if (moved)
            focused?.focus();
        return moved;
    };
    const swapWithNeighbor = (pane, direction) => {
        const candidates = collectLeafPanes(root, isPane);
        const neighbor = directionalNeighbor(pane, candidates, direction);
        return neighbor ? swapPanes(pane, neighbor, onSwap) : false;
    };
    let onKeypress;
    if (options.keymap !== false) {
        const keymap = options.keymap ?? defaultKeymap;
        onKeypress = (event) => {
            const direction = keymap(event);
            if (direction && move(direction))
                event.preventDefault();
        };
        renderer.keyInput.on("keypress", onKeypress);
    }
    return {
        move,
        dispose: () => {
            if (onKeypress)
                renderer.keyInput.off("keypress", onKeypress);
            onKeypress = undefined;
        },
    };
}
//# sourceMappingURL=pane-reorder.js.map