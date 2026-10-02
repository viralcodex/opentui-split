/** @jsxImportSource @opentui/react */
import { expect, test } from "bun:test";
import { MouseButtons, type TestRendererSetup } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import { act, useState } from "react";
import { GutterRenderable, type SplitDirection } from "../src/index.js";
import "../src/react.js";

test("React applies split options and updates them declaratively", async () => {
  let setVertical: ((vertical: boolean) => void) | undefined;
  const calls: number[][] = [];
  let dragCalls = 0;

  function Layout() {
    const [vertical, updateVertical] = useState(false);
    setVertical = updateVertical;
    const direction: SplitDirection = vertical ? "vertical" : "horizontal";

    return (
      <split-pane
        id="split"
        width={60}
        height={60}
        direction={direction}
        sizes={vertical ? [15, 43] : [20, 39]}
        minSizes={[10, 10]}
        gutterSize={vertical ? 2 : 1}
        gutterOptions={{ visible: !vertical }}
        onSizesChange={(sizes) => calls.push(sizes)}
        onMouseDrag={() => dragCalls++}
      >
        <box id="left" />
        <box id="right" />
      </split-pane>
    );
  }

  let setup: TestRendererSetup | undefined;
  await act(async () => {
    setup = await testRender(<Layout />, { width: 80, height: 80 });
  });
  await setup!.renderOnce();

  const split = setup!.renderer.root.getRenderable("split")!;
  expect(split?.getChildren().map((child) => child.id)).toEqual([
    "left",
    "split-gutter-0",
    "right",
  ]);
  let [first, gutter, second] = split.getChildren();
  expect([first!.width, second!.width]).toEqual([20, 39]);

  await setup!.mockMouse.drag(20, 5, 25, 5, MouseButtons.LEFT);
  await setup!.flush();
  expect([first!.width, second!.width]).toEqual([25, 34]);
  expect(dragCalls).toBeGreaterThan(0);

  await act(async () => setVertical?.(true));
  await setup!.renderOnce();
  [first, gutter, second] = split.getChildren();
  expect([first!.height, gutter!.height, second!.height]).toEqual([15, 2, 43]);
  expect([first!.width, second!.width]).toEqual([60, 60]);
  expect((gutter as GutterRenderable).showHairline).toBe(false);

  split.height = 100;
  setup!.renderer.start();
  await setup!.waitFor(() => first!.height > 15);
  setup!.renderer.stop();
  expect(calls.at(-1)).toEqual([first!.height, second!.height]);

  await act(async () => setup!.renderer.destroy());
});
