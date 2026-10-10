import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BoxRenderable, RGBA, TextRenderable } from "@opentui/core";
import { createTestRenderer, MouseButtons, type TestRendererSetup } from "@opentui/core/testing";
import { GutterRenderable, SplitPaneRenderable } from "../src/index.js";

function childrenFit(parent: BoxRenderable): boolean {
  return parent.getChildren().every((child) => {
    const box = child as BoxRenderable;
    return (
      box.x >= parent.x &&
      box.y >= parent.y &&
      box.x + box.width <= parent.x + parent.width &&
      box.y + box.height <= parent.y + parent.height
    );
  });
}

describe("SplitPaneRenderable", () => {
  let setup: TestRendererSetup;

  beforeEach(async () => {
    setup = await createTestRenderer({ width: 120, height: 40 });
  });

  afterEach(() => {
    setup.renderer.destroy();
  });

  test("scales fixed panes when its own layout size changes", async () => {
    const calls: number[][] = [];
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 50,
      height: 10,
      onSizesChange: (sizes) => calls.push(sizes),
    });
    const left = new BoxRenderable(setup.renderer, { id: "left" });
    const right = new BoxRenderable(setup.renderer, { id: "right" });
    split.addPane(left, 20, 5);
    split.addPane(right, 29, 5);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    split.width = 100;
    setup.renderer.start();
    await setup.waitFor(() => left.width === 40);
    setup.renderer.stop();

    expect(left.width).toBe(40);
    expect(right.width).toBe(59);
    expect(calls.at(-1)).toEqual([40, 59]);
  });

  test("resizes only on left drag and reports both pane sizes", async () => {
    const calls: number[][] = [];
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 100,
      height: 10,
      onSizesChange: (sizes) => calls.push(sizes),
    });
    const left = new BoxRenderable(setup.renderer, { id: "left" });
    const right = new BoxRenderable(setup.renderer, { id: "right" });
    split.addPane(left, 40, 10);
    split.addPane(right, 59, 10);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    await setup.mockMouse.drag(40, 5, 50, 5, MouseButtons.RIGHT);
    await setup.flush();
    expect(left.width).toBe(40);
    expect(right.width).toBe(59);
    expect(calls).toHaveLength(0);

    await setup.mockMouse.drag(40, 5, 50, 5, MouseButtons.LEFT);
    await setup.flush();

    expect(left.width).toBe(50);
    expect(right.width).toBe(49);
    expect(calls.at(-1)).toEqual([50, 49]);
  });

  test("clamps fractional minimums to whole cells", async () => {
    const calls: number[][] = [];
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 30,
      height: 10,
      onSizesChange: (sizes) => calls.push(sizes),
    });
    const left = new BoxRenderable(setup.renderer, { id: "left" });
    const right = new BoxRenderable(setup.renderer, { id: "right" });
    split.addPane(left, 15, 10.5);
    split.addPane(right, 14, 10.5);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    await setup.mockMouse.drag(15, 5, 1, 5, MouseButtons.LEFT);
    await setup.flush();

    expect([left.width, right.width]).toEqual([11, 18]);
    expect(calls.at(-1)).toEqual([11, 18]);
  });

  test("recaptures drag sizes after a container resize and preserves mouse handlers", async () => {
    const calls: number[][] = [];
    let dragCalls = 0;
    let upCalls = 0;
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 100,
      height: 10,
      onSizesChange: (sizes) => calls.push(sizes),
      onMouseDrag: () => dragCalls++,
      onMouseUp: () => upCalls++,
    });
    const left = new BoxRenderable(setup.renderer, { id: "left" });
    const right = new BoxRenderable(setup.renderer, { id: "right" });
    split.addPane(left, 40, 10);
    split.addPane(right, 59, 10);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    await setup.mockMouse.pressDown(40, 5, MouseButtons.LEFT);
    await setup.mockMouse.emitMouseEvent("drag", 45, 5, MouseButtons.LEFT);
    await setup.flush();
    split.width = 200;
    await setup.renderOnce();
    await setup.flush();
    await setup.mockMouse.emitMouseEvent("drag", 130, 5, MouseButtons.LEFT);
    await setup.mockMouse.release(130, 5, MouseButtons.LEFT);
    await setup.flush();

    expect(calls.at(-1)).toEqual([left.width, right.width]);
    expect(left.width + right.width).toBe(199);
    expect(dragCalls).toBeGreaterThan(0);
    expect(upCalls).toBeGreaterThan(0);
  });

  test("keeps panes inside the split when it shrinks below their minimums", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 30,
      height: 10,
    });
    const left = new BoxRenderable(setup.renderer, { id: "left" });
    const right = new BoxRenderable(setup.renderer, { id: "right" });
    split.addPane(left, 15, 8);
    split.addPane(right, 14, 8);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    split.width = 10;
    await setup.renderOnce();
    await setup.flush();

    expect(left.x + left.width).toBeLessThanOrEqual(right.x);
    expect(right.x + right.width).toBeLessThanOrEqual(split.x + split.width);
  });

  test("keeps nested panes contained while the terminal shrinks", async () => {
    const outer = new SplitPaneRenderable(setup.renderer, {
      id: "outer",
      width: "100%",
      height: "100%",
    });
    const right = new SplitPaneRenderable(setup.renderer, {
      id: "right",
      direction: "vertical",
    });
    const bottom = new SplitPaneRenderable(setup.renderer, { id: "bottom" });
    const side = new SplitPaneRenderable(setup.renderer, {
      id: "side",
      direction: "vertical",
    });

    outer.addPane(new BoxRenderable(setup.renderer, { id: "pane-1" }), 55, 6);
    outer.addPane(right, 64, 6);
    right.addPane(new BoxRenderable(setup.renderer, { id: "pane-2" }), 19, 6);
    right.addPane(bottom, 20, 6);
    bottom.addPane(new BoxRenderable(setup.renderer, { id: "pane-3" }), 50, 6);
    bottom.addPane(side, 13, 6);
    side.addPane(new BoxRenderable(setup.renderer, { id: "pane-4" }), 9, 6);
    side.addPane(new BoxRenderable(setup.renderer, { id: "pane-5" }), 10, 6);
    setup.renderer.root.add(outer);
    await setup.renderOnce();

    setup.resize(30, 14);
    setup.renderer.start();
    await setup.waitFor(
      () =>
        outer.width === 30 &&
        outer.height === 14 &&
        [outer, right, bottom, side].every(childrenFit),
    );

    expect([outer, right, bottom, side].every(childrenFit)).toBe(true);
  });

  test("treats normal box children as panes across insertions and removals", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 100,
      height: 10,
      sizes: [20, 30, 48],
    });
    const first = new BoxRenderable(setup.renderer, { id: "first" });
    const second = new BoxRenderable(setup.renderer, { id: "second" });
    const middle = new BoxRenderable(setup.renderer, { id: "middle" });

    split.add(first);
    split.add(second);
    split.insertBefore(middle, second);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    expect(split.getChildren().map((child) => child.id)).toEqual([
      "first",
      "split-gutter-0",
      "middle",
      "split-gutter-1",
      "second",
    ]);
    const gutters = split.getChildren().filter((child) => child instanceof GutterRenderable);
    expect(gutters.every((gutter) => gutter.showHairline)).toBe(true);

    split.remove(middle);
    await setup.renderOnce();
    expect(split.getChildren().map((child) => child.id)).toEqual([
      "first",
      "split-gutter-0",
      "second",
    ]);

    expect(split.movePane(first, 99)).toBe(true);
    await setup.renderOnce();
    expect(split.paneList.map((pane) => pane.id)).toEqual(["second", "first"]);
    expect(split.movePane(first, 1)).toBe(false);
    expect(() => split.movePane(first, Number.NaN)).toThrow("toIndex must be a finite integer");
    expect(first.width).toBeGreaterThan(0);
  });

  test("keeps generated gutters owned and rejects unsupported children", () => {
    const split = new SplitPaneRenderable(setup.renderer, { id: "split" });
    split.add(new BoxRenderable(setup.renderer, { id: "left" }));
    split.add(new BoxRenderable(setup.renderer, { id: "right" }));
    const gutter = split.getChildren()[1]!;
    const text = new TextRenderable(setup.renderer, { id: "text", content: "not a pane" });

    expect(() => split.remove(gutter)).toThrow("Cannot remove a generated gutter");
    expect(split.add(text)).toBe(-1);
    expect(text.parent).toBeNull();
    text.destroy();
  });

  test("rejects invalid pane and gutter sizes", () => {
    expect(
      () =>
        new SplitPaneRenderable(setup.renderer, {
          id: "invalid-direction",
          direction: "diagonal" as "horizontal",
        }),
    ).toThrow('direction must be "horizontal" or "vertical"');
    expect(
      () => new SplitPaneRenderable(setup.renderer, { id: "invalid-gutter", gutterSize: 0 }),
    ).toThrow("gutterSize must be a positive integer");

    const split = new SplitPaneRenderable(setup.renderer, { id: "split" });
    const pane = new BoxRenderable(setup.renderer, { id: "pane" });
    expect(() => split.addPane(pane, Number.NaN)).toThrow("size must contain");
    expect(() => split.addPane(pane, -1)).toThrow("size must contain");
  });

  test("hides gutters when gutter visibility is false but still resizes", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 100,
      height: 10,
      gutterOptions: { visible: false },
    });
    const left = new BoxRenderable(setup.renderer, { id: "left" });
    const right = new BoxRenderable(setup.renderer, { id: "right" });
    split.addPane(left, 40, 10);
    split.addPane(right, 59, 10);
    setup.renderer.root.add(split);
    await setup.renderOnce();

    const gutter = split.getChildren().find((child) => child instanceof GutterRenderable);
    expect((gutter as GutterRenderable).showHairline).toBe(false);

    // Dragging the (invisible) gutter still conserves size.
    await setup.mockMouse.drag(40, 5, 50, 5, MouseButtons.LEFT);
    await setup.flush();
    expect(left.width).toBe(50);
    expect(right.width).toBe(49);
  });

  test("applies gutter glyphs and color", async () => {
    const color = "red";
    const expectedColor = RGBA.fromInts(255, 0, 0);
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 60,
      height: 10,
      gutterOptions: {
        color,
        glyphs: { horizontal: "!", vertical: "=" },
      },
    });
    split.add(new BoxRenderable(setup.renderer, { id: "left" }));
    split.add(new BoxRenderable(setup.renderer, { id: "right" }));
    setup.renderer.root.add(split);

    const verticalSplit = new SplitPaneRenderable(setup.renderer, {
      id: "vertical-split",
      direction: "vertical",
      position: "absolute",
      left: 70,
      width: 20,
      height: 10,
      gutterOptions: { color, glyphs: { horizontal: "!", vertical: "=" } },
    });
    verticalSplit.add(new BoxRenderable(setup.renderer, { id: "top" }));
    verticalSplit.add(new BoxRenderable(setup.renderer, { id: "bottom" }));
    setup.renderer.root.add(verticalSplit);
    await setup.renderOnce();

    const gutter = split.getChildren()[1] as GutterRenderable;
    expect(gutter).toBeInstanceOf(GutterRenderable);
    expect(setup.captureCharFrame()).toContain("!");
    expect(setup.captureCharFrame()).toContain("=");
    const spans = setup.captureSpans().lines.flatMap((line) => line.spans);
    expect(spans.find((span) => span.text.includes("!"))?.fg).toEqual(expectedColor);
  });

  test("setGutterVisible applies to current and future gutters", async () => {
    const split = new SplitPaneRenderable(setup.renderer, { id: "split", width: 90, height: 10 });
    split.add(new BoxRenderable(setup.renderer, { id: "a" }));
    split.add(new BoxRenderable(setup.renderer, { id: "b" }));
    setup.renderer.root.add(split);
    await setup.renderOnce();

    split.setGutterVisible(false);
    split.add(new BoxRenderable(setup.renderer, { id: "c" }));

    const gutters = split
      .getChildren()
      .filter((child) => child instanceof GutterRenderable) as GutterRenderable[];
    expect(gutters).toHaveLength(2);
    expect(gutters.every((gutter) => !gutter.showHairline)).toBe(true);

    split.setGutterVisible(true);
    expect(gutters.every((gutter) => gutter.showHairline)).toBe(true);
  });

  test("rebuilds gutters when gutterSize changes", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 60,
      height: 10,
    });
    split.add(new BoxRenderable(setup.renderer, { id: "left" }));
    split.add(new BoxRenderable(setup.renderer, { id: "right" }));
    setup.renderer.root.add(split);
    await setup.renderOnce();

    split.gutterSize = 3;
    await setup.renderOnce();

    const gutter = split.getChildren()[1];
    expect(gutter).toBeInstanceOf(GutterRenderable);
    expect(gutter!.width).toBe(3);
  });
});
