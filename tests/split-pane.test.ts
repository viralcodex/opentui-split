import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { BoxRenderable } from "@opentui/core"
import {
  createTestRenderer,
  MouseButtons,
  type TestRendererSetup,
} from "@opentui/core/testing"
import { GutterRenderable, SplitPaneRenderable } from "../src/index.js"

class TestGutterRenderable extends GutterRenderable {
  get cursor(): string {
    return this.resizeCursor
  }
}

function childrenFit(parent: BoxRenderable): boolean {
  return parent.getChildren().every((child) => {
    const box = child as BoxRenderable
    return (
      box.x >= parent.x &&
      box.y >= parent.y &&
      box.x + box.width <= parent.x + parent.width &&
      box.y + box.height <= parent.y + parent.height
    )
  })
}

describe("SplitPaneRenderable", () => {
  let setup: TestRendererSetup

  beforeEach(async () => {
    setup = await createTestRenderer({ width: 120, height: 40 })
  })

  afterEach(() => {
    setup.renderer.destroy()
  })

  test("scales fixed panes when its own layout size changes", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 50,
      height: 10,
    })
    const left = new BoxRenderable(setup.renderer, { id: "left" })
    const right = new BoxRenderable(setup.renderer, { id: "right" })
    split.addPane(left, 20, 5)
    split.addPane(right, 29, 5)
    setup.renderer.root.add(split)
    await setup.renderOnce()

    split.width = 100
    setup.renderer.start()
    await setup.waitFor(() => left.width === 40)
    setup.renderer.stop()

    expect(left.width).toBe(40)
    expect(right.width).toBe(59)
  })

  test("only starts a drag with the left mouse button", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 100,
      height: 10,
    })
    const left = new BoxRenderable(setup.renderer, { id: "left" })
    const right = new BoxRenderable(setup.renderer, { id: "right" })
    split.addPane(left, 40, 10)
    split.addPane(right, 59, 10)
    setup.renderer.root.add(split)
    await setup.renderOnce()

    await setup.mockMouse.drag(40, 5, 50, 5, MouseButtons.RIGHT)
    await setup.flush()

    expect(left.width).toBe(40)
    expect(right.width).toBe(59)
  })

  test("uses a crosshair cursor for both gutter orientations", () => {
    const horizontal = new TestGutterRenderable(setup.renderer, {
      id: "horizontal-gutter",
      direction: "horizontal",
      onGrab: () => {},
    })
    const vertical = new TestGutterRenderable(setup.renderer, {
      id: "vertical-gutter",
      direction: "vertical",
      onGrab: () => {},
    })

    expect(horizontal.cursor).toBe("crosshair")
    expect(vertical.cursor).toBe("crosshair")
  })

  test("reports both pane sizes after dragging the last gutter", async () => {
    const calls: number[][] = []
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 100,
      height: 10,
      onResize: (sizes) => calls.push(sizes),
    })
    const left = new BoxRenderable(setup.renderer, { id: "left" })
    const right = new BoxRenderable(setup.renderer, { id: "right" })
    split.addPane(left, 40, 10)
    split.addPane(right, 59, 10)
    setup.renderer.root.add(split)
    await setup.renderOnce()

    await setup.mockMouse.drag(40, 5, 50, 5, MouseButtons.LEFT)
    await setup.flush()

    expect(left.width).toBe(50)
    expect(right.width).toBe(49)
    expect(calls.at(-1)).toEqual([50, 49])
  })

  test("keeps panes inside the split when it shrinks below their minimums", async () => {
    const split = new SplitPaneRenderable(setup.renderer, {
      id: "split",
      width: 30,
      height: 10,
    })
    const left = new BoxRenderable(setup.renderer, { id: "left" })
    const right = new BoxRenderable(setup.renderer, { id: "right" })
    split.addPane(left, 15, 8)
    split.addPane(right, 14, 8)
    setup.renderer.root.add(split)
    await setup.renderOnce()

    split.width = 10
    await setup.renderOnce()
    await setup.flush()

    expect(left.x + left.width).toBeLessThanOrEqual(right.x)
    expect(right.x + right.width).toBeLessThanOrEqual(split.x + split.width)
  })

  test("keeps nested panes contained while the terminal shrinks", async () => {
    const outer = new SplitPaneRenderable(setup.renderer, {
      id: "outer",
      width: "100%",
      height: "100%",
    })
    const right = new SplitPaneRenderable(setup.renderer, {
      id: "right",
      direction: "vertical",
    })
    const bottom = new SplitPaneRenderable(setup.renderer, { id: "bottom" })
    const side = new SplitPaneRenderable(setup.renderer, {
      id: "side",
      direction: "vertical",
    })

    outer.addPane(new BoxRenderable(setup.renderer, { id: "pane-1" }), 55, 6)
    outer.addPane(right, 64, 6)
    right.addPane(new BoxRenderable(setup.renderer, { id: "pane-2" }), 19, 6)
    right.addPane(bottom, 20, 6)
    bottom.addPane(new BoxRenderable(setup.renderer, { id: "pane-3" }), 50, 6)
    bottom.addPane(side, 13, 6)
    side.addPane(new BoxRenderable(setup.renderer, { id: "pane-4" }), 9, 6)
    side.addPane(new BoxRenderable(setup.renderer, { id: "pane-5" }), 10, 6)
    setup.renderer.root.add(outer)
    await setup.renderOnce()

    setup.resize(30, 14)
    setup.renderer.start()
    await setup.waitFor(
      () =>
        outer.width === 30 &&
        outer.height === 14 &&
        [outer, right, bottom, side].every(childrenFit),
    )

    expect([outer, right, bottom, side].every(childrenFit)).toBe(true)
  })

})