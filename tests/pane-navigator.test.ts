import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BoxRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { createPaneNavigator } from "../src/index.js";

describe("createPaneNavigator", () => {
  let setup: TestRendererSetup;

  function addPane(id: string): BoxRenderable {
    const pane = new BoxRenderable(setup.renderer, { id, focusable: true });
    setup.renderer.root.add(pane);
    return pane;
  }

  beforeEach(async () => {
    setup = await createTestRenderer({ width: 40, height: 20 });
  });

  afterEach(() => {
    setup.renderer.destroy();
  });

  test("cycles focus forward and backward with Tab", async () => {
    const first = addPane("first");
    const second = addPane("second");
    const changes: string[] = [];
    const navigator = createPaneNavigator(setup.renderer, {
      onFocusChange: (current, previous) =>
        changes.push(`${previous?.id ?? "none"}->${current.id}`),
    });
    await setup.renderOnce();

    setup.mockInput.pressTab();
    expect(navigator.current).toBe(first);

    setup.mockInput.pressTab();
    expect(navigator.current).toBe(second);

    setup.mockInput.pressTab({ shift: true });
    expect(navigator.current).toBe(first);
    expect(changes).toEqual(["none->first", "first->second", "second->first"]);

    navigator.dispose();
    setup.mockInput.pressTab();
    expect(navigator.current).toBe(first);
  });

  test("wraps around the ends by default and clamps when disabled", async () => {
    const first = addPane("first");
    const second = addPane("second");
    const wrapping = createPaneNavigator(setup.renderer, { keymap: false });
    const last = addPane("last");

    expect(wrapping.panes).toEqual([first, second, last]);

    wrapping.focusPane(last);
    wrapping.focusNext();

    expect(wrapping.current).toBe(first);
    wrapping.dispose();

    const clamped = createPaneNavigator(setup.renderer, { keymap: false, wrap: false });
    clamped.focusPane(last);
    clamped.focusNext();
    expect(clamped.current).toBe(last);
  });

  test("honours custom keys and a pane predicate", async () => {
    const chrome = new BoxRenderable(setup.renderer, { id: "chrome", focusable: true });
    setup.renderer.root.add(chrome);
    const editor = new BoxRenderable(setup.renderer, { id: "editor", focusable: true });
    setup.renderer.root.add(editor);

    const navigator = createPaneNavigator(setup.renderer, {
      keymap: (event) => (event.ctrl && event.name === "l" ? "next" : undefined),
      isPane: (renderable) => renderable.id !== "chrome",
    });
    await setup.renderOnce();

    setup.mockInput.pressTab();
    expect(navigator.current).toBeNull();

    setup.mockInput.pressKey("l", { ctrl: true });
    expect(navigator.current).toBe(editor);
  });
});
