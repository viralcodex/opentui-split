import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BoxRenderable, TextRenderable } from "@opentui/core";
import { createTestRenderer, MouseButtons, type TestRendererSetup } from "@opentui/core/testing";
import { createPaneMovement, SplitPaneRenderable } from "../src/index.js";

const CTRL = { modifiers: { ctrl: true } } as const;
const ALT = { meta: true } as const;

describe("pane movement", () => {
  let setup: TestRendererSetup;

  const pane = (id: string): BoxRenderable =>
    new BoxRenderable(setup.renderer, { id, focusable: true });
  const ids = (split: SplitPaneRenderable): string[] => split.paneList.map((child) => child.id);
  const center = (child: BoxRenderable, axis: "x" | "y"): number =>
    axis === "x" ? child.x + Math.floor(child.width / 2) : child.y + Math.floor(child.height / 2);

  async function buildSplit(direction: "horizontal" | "vertical" = "horizontal") {
    const horizontal = direction === "horizontal";
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      direction,
      width: horizontal ? 90 : 20,
      height: horizontal ? 20 : 36,
    });
    const panes = [pane("a"), pane("b"), pane("c")];
    for (const child of panes) split.addPane(child, 10, 4);
    setup.renderer.root.add(split);
    await setup.renderOnce();
    return { split, panes };
  }

  async function buildNested() {
    const left = new SplitPaneRenderable(setup.renderer, {
      id: "left",
      direction: "vertical",
    });
    const right = new SplitPaneRenderable(setup.renderer, {
      id: "right",
      direction: "vertical",
    });
    const panes = { a: pane("a"), b: pane("b"), c: pane("c"), d: pane("d") };
    left.addPane(panes.a, 8, 2);
    left.addPane(panes.b, 8, 2);
    right.addPane(panes.c, 8, 2);
    right.addPane(panes.d, 8, 2);

    const outer = new SplitPaneRenderable(setup.renderer, {
      id: "outer",
      direction: "horizontal",
      width: 80,
      height: 24,
    });
    outer.addPane(left, 40, 10);
    outer.addPane(right, 40, 10);
    setup.renderer.root.add(outer);
    await setup.renderOnce();
    return { left, right, panes };
  }

  beforeEach(async () => {
    setup = await createTestRenderer({ width: 120, height: 40 });
  });

  afterEach(() => setup.renderer.destroy());

  test("drag requires its modifier, supports nested content, and disposes", async () => {
    const { split, panes } = await buildSplit();
    panes[0]!.add(new TextRenderable(setup.renderer, { content: "widget" }));
    const moves: Array<[number, number]> = [];
    let downs = 0;
    setup.renderer.root.onMouseDown = () => downs++;
    const controller = createPaneMovement(setup.renderer, {
      onReorder: (_split, from, to) => moves.push([from, to]),
    });
    await setup.renderOnce();

    const drag = (options?: typeof CTRL) =>
      setup.mockMouse.drag(
        center(panes[0]!, "x"),
        5,
        center(panes[2]!, "x"),
        5,
        MouseButtons.LEFT,
        options,
      );
    await drag();
    await drag(CTRL);
    controller.dispose();
    await drag(CTRL);

    expect(ids(split)).toEqual(["b", "c", "a"]);
    expect(moves).toEqual([[0, 2]]);
    expect(downs).toBe(3);
  });

  test("drag inserts beside the target and cancels outside the split", async () => {
    const { split, panes } = await buildSplit();
    createPaneMovement(setup.renderer);

    await setup.mockMouse.drag(
      center(panes[0]!, "x"),
      5,
      panes[1]!.x + panes[1]!.width - 1,
      5,
      MouseButtons.LEFT,
      CTRL,
    );
    expect(ids(split)).toEqual(["b", "a", "c"]);

    await setup.mockMouse.drag(
      center(panes[1]!, "x"),
      5,
      split.x + split.width + 5,
      5,
      MouseButtons.LEFT,
      CTRL,
    );
    expect(ids(split)).toEqual(["b", "a", "c"]);
  });

  test("drag handles work without a modifier on either axis", async () => {
    const { split, panes } = await buildSplit("vertical");
    const handles = panes.map((child) => {
      const handle = new BoxRenderable(setup.renderer, { id: `${child.id}-handle`, height: 1 });
      child.add(handle);
      return handle;
    });
    const controller = createPaneMovement(setup.renderer, {
      modifier: false,
      handle: (node) => node.id.endsWith("-handle"),
    });
    await setup.renderOnce();

    await setup.mockMouse.drag(5, center(panes[2]!, "y"), 5, panes[0]!.y);
    await setup.mockMouse.drag(5, handles[2]!.y, 5, handles[0]!.y);

    expect(ids(split)).toEqual(["c", "a", "b"]);
    expect(controller.dragging).toBe(false);
  });

  test("drag swaps leaf panes across splits without rebuilding gutters", async () => {
    const { left, right, panes } = await buildNested();
    const gutter = left.getChildren()[1];
    const sizes = left.sizes;
    const swaps: Array<[string, string]> = [];
    createPaneMovement(setup.renderer, {
      onSwap: (first, second) => swaps.push([first.id, second.id]),
    });

    await setup.mockMouse.drag(
      center(panes.a, "x"),
      center(panes.a, "y"),
      center(panes.c, "x"),
      center(panes.c, "y"),
      MouseButtons.LEFT,
      CTRL,
    );

    expect(ids(left)).toEqual(["c", "b"]);
    expect(ids(right)).toEqual(["a", "d"]);
    expect(left.getChildren()[1]).toBe(gutter);
    expect(left.sizes).toEqual(sizes);
    expect(swaps).toEqual([["a", "c"]]);
  });

  test("keyboard moves keep focus, support macOS aliases, and dispose", async () => {
    const { split, panes } = await buildSplit();
    const moves: Array<[number, number]> = [];
    const controller = createPaneMovement(setup.renderer, {
      onReorder: (_split, from, to) => moves.push([from, to]),
    });
    panes[0]!.focus();

    setup.mockInput.pressArrow("right", ALT);
    setup.mockInput.pressKey("f", ALT);
    setup.mockInput.pressKey("b", ALT);
    await setup.flush();
    controller.dispose();
    setup.mockInput.pressArrow("right", ALT);
    await setup.flush();

    expect(ids(split)).toEqual(["b", "a", "c"]);
    expect(setup.renderer.currentFocusedRenderable).toBe(panes[0]!);
    expect(moves).toEqual([
      [0, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  test("manual moves respect the split axis and bounds", async () => {
    const { split, panes } = await buildSplit();
    const controller = createPaneMovement(setup.renderer, { keymap: false });
    panes[0]!.focus();

    expect(controller.move("down")).toBe(false);
    expect(controller.move("left")).toBe(false);
    split.direction = "vertical";
    panes[2]!.focus();
    expect(controller.move("up")).toBe(true);
    expect(ids(split)).toEqual(["a", "c", "b"]);
  });

  test("keyboard movement stays inside its configured root", async () => {
    const { left, right, panes } = await buildNested();
    const controller = createPaneMovement(setup.renderer, { root: left, keymap: false });
    panes.c.focus();

    expect(controller.move("down")).toBe(false);
    expect(ids(right)).toEqual(["c", "d"]);

    panes.a.focus();
    expect(controller.move("down")).toBe(true);
    expect(ids(left)).toEqual(["b", "a"]);
  });

  test("keyboard swaps with the nearest leaf pane across splits", async () => {
    const { left, right, panes } = await buildNested();
    const gutter = left.getChildren()[1];
    const swaps: Array<[string, string]> = [];
    const controller = createPaneMovement(setup.renderer, {
      keymap: false,
      onSwap: (first, second) => swaps.push([first.id, second.id]),
    });
    panes.a.focus();

    expect(controller.move("right")).toBe(true);
    expect(ids(left)).toEqual(["c", "b"]);
    expect(ids(right)).toEqual(["a", "d"]);
    expect(left.getChildren()[1]).toBe(gutter);
    expect(setup.renderer.currentFocusedRenderable).toBe(panes.a);
    expect(swaps).toEqual([["a", "c"]]);
  });
});
