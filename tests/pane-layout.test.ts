import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BoxRenderable } from "@opentui/core";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { captureLayout, restoreLayout, SplitPaneRenderable } from "../src/index.js";

describe("layout persistence", () => {
  let setup: TestRendererSetup;

  beforeEach(async () => {
    setup = await createTestRenderer({ width: 120, height: 40 });
  });

  afterEach(() => setup.renderer.destroy());

  test("round-trips nested pane order and proportions at a different size", async () => {
    const ctx = setup.renderer;
    const original = new SplitPaneRenderable(ctx, { width: 61, height: 21 });
    const nested = new SplitPaneRenderable(ctx, { direction: "vertical" });
    const sidebar = new BoxRenderable(ctx, { id: "sidebar" });
    nested.addPane(new BoxRenderable(ctx, { id: "top" }), 5);
    nested.addPane(new BoxRenderable(ctx, { id: "bottom" }), 15);
    original.addPane(sidebar, 20);
    original.addPane(nested, 40);
    ctx.root.add(original);
    await setup.renderOnce();
    await setup.flush();

    const beforeCollapse = captureLayout(original);
    original.width = 0;
    await setup.renderOnce();
    await setup.flush();
    const saved = JSON.parse(JSON.stringify(captureLayout(original)));
    expect(saved).toEqual(beforeCollapse);
    expect(saved).toEqual({
      direction: "horizontal",
      weights: [20, 40],
      children: [
        { paneId: "sidebar" },
        {
          direction: "vertical",
          weights: [5, 15],
          children: [{ paneId: "top" }, { paneId: "bottom" }],
        },
      ],
    });
    original.destroyRecursively();
    const restored = restoreLayout(ctx, saved, (id) => new BoxRenderable(ctx, { id }), {
      width: 91,
      height: 33,
    }) as SplitPaneRenderable;
    ctx.root.add(restored);
    await setup.renderOnce();
    await setup.flush();
    expect(restored.sizes).toEqual([30, 60]);
    const right = restored.paneList[1] as SplitPaneRenderable;
    expect(right.sizes).toEqual([8, 24]);
    expect(right.paneList.map((pane) => pane.id)).toEqual(["top", "bottom"]);

    restored.width = 61;
    await setup.renderOnce();
    await setup.flush();
    expect(restored.sizes).toEqual([20, 40]);
  });

  test("rejects invalid JSON layouts before resolving panes", () => {
    let calls = 0;
    const resolve = (id: string) => {
      calls++;
      return new BoxRenderable(setup.renderer, { id });
    };
    for (const layout of [
      null,
      {},
      { paneId: "" },
      { direction: "diagonal", weights: [], children: [] },
      { direction: "horizontal", weights: [1], children: [] },
      { direction: "horizontal", weights: [-1], children: [{ paneId: "a" }] },
      { direction: "horizontal", weights: [Infinity], children: [{ paneId: "a" }] },
      { direction: "horizontal", weights: Array(1), children: [{ paneId: "a" }] },
      {
        direction: "horizontal",
        weights: [1, 1],
        children: Object.assign(Array(2), { 0: { paneId: "a" } }),
      },
      { direction: "horizontal", weights: [1, 1], children: [{ paneId: "a" }, { paneId: "a" }] },
    ])
      expect(() => restoreLayout(setup.renderer, layout, resolve)).toThrow(TypeError);
    expect(calls).toBe(0);
  });

  test.each(["reorder", "resize"])("honors pre-render %s", async (change) => {
    const split = restoreLayout(
      setup.renderer,
      {
        direction: "horizontal",
        weights: [1, 3],
        children: [{ paneId: "a" }, { paneId: "b" }],
      },
      (id) => new BoxRenderable(setup.renderer, { id }),
      { width: 101, height: 10 },
    ) as SplitPaneRenderable;
    if (change === "reorder") split.movePane(split.paneList[0]!, 1);
    else split.sizes = [75, 25];
    setup.renderer.root.add(split);
    await setup.renderOnce();
    await setup.flush();
    expect(split.sizes).toEqual([75, 25]);
    expect(split.paneList.map((pane) => pane.id)).toEqual(
      change === "reorder" ? ["b", "a"] : ["a", "b"],
    );
  });

  test("rejects attached panes without moving them", () => {
    const pane = new BoxRenderable(setup.renderer, { id: "attached" });
    setup.renderer.root.add(pane);
    expect(() => restoreLayout(setup.renderer, { paneId: pane.id }, () => pane)).toThrow(TypeError);
    expect(pane.parent).toBe(setup.renderer.root);
    expect(pane.isDestroyed).toBe(false);
  });

  test.each(["resolver", "options"])("cleans up accepted panes on %s failure", (failure) => {
    const created: BoxRenderable[] = [];
    expect(() =>
      restoreLayout(
        setup.renderer,
        {
          direction: "horizontal",
          weights: [1, 3],
          children: [{ paneId: "a" }, { paneId: "b" }],
        },
        (id) => {
          if (failure === "resolver" && id === "b") throw new Error("resolver failed");
          const pane = new BoxRenderable(setup.renderer, { id });
          created.push(pane);
          return pane;
        },
        failure === "options" ? { gutterSize: 0 } : {},
      ),
    ).toThrow(failure === "resolver" ? "resolver failed" : "gutterSize");
    expect(created).toHaveLength(failure === "resolver" ? 1 : 2);
    expect(created.every((pane) => pane.isDestroyed)).toBe(true);
  });

  test.each([0, 1e40, 1e307, Number.MAX_VALUE, Number.MIN_VALUE])(
    "restores equal weights %s after an initially collapsed layout",
    async (weight) => {
      const split = restoreLayout(
        setup.renderer,
        {
          direction: "horizontal",
          weights: [weight, weight],
          children: [{ paneId: "a" }, { paneId: "b" }],
        },
        (id) => new BoxRenderable(setup.renderer, { id }),
        {
          width: 0,
          height: 10,
        },
      ) as SplitPaneRenderable;
      setup.renderer.root.add(split);
      await setup.renderOnce();
      split.width = 41;
      await setup.renderOnce();
      await setup.flush();
      expect(split.sizes).toEqual([20, 20]);
      split.sizes = [10, 1];
      await setup.renderOnce();
      await setup.flush();
      expect(split.sizes).toEqual([10, 30]);
    },
  );
});
