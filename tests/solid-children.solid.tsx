/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { BoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
import { GutterRenderable } from "../src/index.js";
import "../src/solid.js";

test("Solid applies split options and updates children declaratively", async () => {
  const [vertical, setVertical] = createSignal(false);
  const [showMiddle, setShowMiddle] = createSignal(false);
  const setup = await testRender(
    () => (
      <split_pane
        id="split"
        width={60}
        height={60}
        direction={vertical() ? "vertical" : "horizontal"}
        sizes={vertical() ? [15, 20, 21] : [20, 39]}
        minSizes={[10, 10]}
        gutterSize={vertical() ? 2 : 1}
        gutterOptions={{ visible: !vertical() }}
      >
        <box id="left" />
        <Show when={showMiddle()}>
          <box id="middle" />
        </Show>
        <box id="right" />
      </split_pane>
    ),
    { width: 80, height: 80 },
  );
  await setup.renderOnce();

  const split = setup.renderer.root.getRenderable("split")!;
  const children = split?.getChildren() ?? [];
  expect(
    children
      .filter((child) => child instanceof BoxRenderable && !(child instanceof GutterRenderable))
      .map((child) => child.id),
  ).toEqual(["left", "right"]);
  expect(children.some((child) => child instanceof GutterRenderable)).toBe(true);

  setVertical(true);
  setShowMiddle(true);
  await setup.renderOnce();
  await setup.flush();

  const updated = split.getChildren();
  const layoutChildren = updated.filter((child) => child instanceof BoxRenderable);
  expect(
    layoutChildren.filter((child) => !(child instanceof GutterRenderable)).map((child) => child.id),
  ).toEqual(["left", "middle", "right"]);
  expect(layoutChildren.map((child) => child.height)).toEqual([15, 2, 20, 2, 21]);
  expect(
    layoutChildren
      .filter((child) => !(child instanceof GutterRenderable))
      .map((child) => child.width),
  ).toEqual([60, 60, 60]);
  expect(
    updated
      .filter((child) => child instanceof GutterRenderable)
      .every((gutter) => !gutter.showHairline),
  ).toBe(true);
  setup.renderer.destroy();
});
