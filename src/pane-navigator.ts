import {
  type BaseRenderable,
  type CliRenderer,
  isRenderable,
  type KeyEvent,
  type Renderable,
} from "@opentui/core";
import type { PaneNavigator, PaneNavigatorOptions } from "./models.js";

function defaultKeymap(event: KeyEvent): "next" | "previous" | undefined {
  if (event.name !== "tab" || event.ctrl || event.meta || event.option) return;
  return event.shift ? "previous" : "next";
}

function collectPanes(
  root: BaseRenderable,
  isPane: (renderable: Renderable) => boolean,
): Renderable[] {
  const panes: Renderable[] = [];
  const visit = (node: BaseRenderable): void => {
    for (const child of node.getChildren()) {
      if (isRenderable(child) && isPane(child)) panes.push(child);
      visit(child);
    }
  };
  visit(root);
  return panes;
}

export function createPaneNavigator(
  renderer: CliRenderer,
  options: PaneNavigatorOptions = {},
): PaneNavigator {
  const root = options.root ?? renderer.root;
  const isPane = options.isPane ?? ((renderable: Renderable) => renderable.focusable);
  const wrap = options.wrap ?? true;
  const onFocusChange = options.onFocusChange;

  const findCurrentPane = (panes: Renderable[]): Renderable | null => {
    const focused = renderer.currentFocusedRenderable;
    return focused && panes.includes(focused) ? focused : null;
  };

  const focusPaneAt = (panes: Renderable[], index: number): void => {
    const target = panes[index];
    if (!target) return;
    const previous = findCurrentPane(panes);
    if (target === previous) return;
    target.focus();
    if (renderer.currentFocusedRenderable !== target) return;
    onFocusChange?.(target, previous);
  };

  const moveFocus = (delta: 1 | -1): void => {
    const panes = collectPanes(root, isPane);
    if (panes.length === 0) return;
    const current = findCurrentPane(panes);
    const from = current ? panes.indexOf(current) : delta === 1 ? -1 : 0;
    const next = wrap
      ? (from + delta + panes.length) % panes.length
      : Math.max(0, Math.min(panes.length - 1, from + delta));
    focusPaneAt(panes, next);
  };

  let onKeypress: ((event: KeyEvent) => void) | undefined;
  if (options.keymap !== false) {
    const keymap = options.keymap ?? defaultKeymap;
    onKeypress = (event: KeyEvent) => {
      const navigation = keymap(event);
      if (!navigation) return;
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
    focusPane: (target: number | Renderable) => {
      const panes = collectPanes(root, isPane);
      focusPaneAt(panes, typeof target === "number" ? target : panes.indexOf(target));
    },
    dispose: () => {
      if (onKeypress) renderer.keyInput.off("keypress", onKeypress);
      onKeypress = undefined;
    },
  };
}
