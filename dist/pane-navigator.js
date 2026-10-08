import { isRenderable, } from "@opentui/core";
function defaultKeymap(event) {
    if (event.name !== "tab" || event.ctrl || event.meta || event.option)
        return;
    return event.shift ? "previous" : "next";
}
function collectPanes(root, isPane) {
    const panes = [];
    const visit = (node) => {
        for (const child of node.getChildren()) {
            if (isRenderable(child) && isPane(child))
                panes.push(child);
            visit(child);
        }
    };
    visit(root);
    return panes;
}
export function createPaneNavigator(renderer, options = {}) {
    const root = options.root ?? renderer.root;
    const isPane = options.isPane ?? ((renderable) => renderable.focusable);
    const wrap = options.wrap ?? true;
    const onFocusChange = options.onFocusChange;
    const findCurrentPane = (panes) => {
        const focused = renderer.currentFocusedRenderable;
        return focused && panes.includes(focused) ? focused : null;
    };
    const focusPaneAt = (panes, index) => {
        const target = panes[index];
        if (!target)
            return;
        const previous = findCurrentPane(panes);
        if (target === previous)
            return;
        target.focus();
        if (renderer.currentFocusedRenderable !== target)
            return;
        onFocusChange?.(target, previous);
    };
    const moveFocus = (delta) => {
        const panes = collectPanes(root, isPane);
        if (panes.length === 0)
            return;
        const current = findCurrentPane(panes);
        const from = current ? panes.indexOf(current) : delta === 1 ? -1 : 0;
        const next = wrap
            ? (from + delta + panes.length) % panes.length
            : Math.max(0, Math.min(panes.length - 1, from + delta));
        focusPaneAt(panes, next);
    };
    let onKeypress;
    if (options.keymap !== false) {
        const keymap = options.keymap ?? defaultKeymap;
        onKeypress = (event) => {
            const navigation = keymap(event);
            if (!navigation)
                return;
            event.preventDefault();
            moveFocus(navigation === "next" ? 1 : -1);
        };
        renderer.keyInput.on("keypress", onKeypress);
    }
    return {
        get panes() {
            return collectPanes(root, isPane);
        },
        get current() {
            return findCurrentPane(collectPanes(root, isPane));
        },
        focusNext: () => moveFocus(1),
        focusPrevious: () => moveFocus(-1),
        focusPane: (target) => {
            const panes = collectPanes(root, isPane);
            focusPaneAt(panes, typeof target === "number" ? target : panes.indexOf(target));
        },
        dispose: () => {
            if (onKeypress)
                renderer.keyInput.off("keypress", onKeypress);
            onKeypress = undefined;
        },
    };
}
//# sourceMappingURL=pane-navigator.js.map