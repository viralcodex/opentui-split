import { test, expect, beforeEach, afterEach } from "bun:test"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { BoxRenderable, type Renderable } from "@opentui/core"
import { run } from "./demo.ts"

let setup: TestRendererSetup

/** getRenderable only checks direct children; panes live inside nested splits. */
function findById(root: Renderable, id: string): Renderable | undefined {
  if (root.id === id) return root
  for (const child of root.getChildren() as Renderable[]) {
    const found = findById(child, id)
    if (found) return found
  }
  return undefined
}

beforeEach(async () => {
  setup = await createTestRenderer({ width: 100, height: 40 })
  run(setup.renderer)
  await setup.renderOnce()
})

afterEach(() => {
  setup?.renderer.stop()
})

test("horizontal drag on the gutter resizes the sidebar (survives cursor leaving 1-cell gutter)", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  const sidebar = findById(renderer.root, "sidebar") as BoxRenderable
  const gutter = findById(renderer.root, "outer-split-gutter-0") as BoxRenderable

  const startWidth = sidebar.width
  const gx = gutter.x
  const gy = gutter.y + 2

  // Grab the gutter, then drag well past it into the neighbouring pane — this is
  // exactly the case that used to fail (renderer captures the pane, not the gutter).
  await mockMouse.drag(gx, gy, gx + 12, gy)
  await renderOnce()

  expect(sidebar.width).toBeGreaterThan(startWidth)
  expect(sidebar.width).toBe(startWidth + 12)
})

test("drag clamps to the pane minimum", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  const sidebar = findById(renderer.root, "sidebar") as BoxRenderable
  const gutter = findById(renderer.root, "outer-split-gutter-0") as BoxRenderable

  const gy = gutter.y + 2
  // Drag hard to the left, far past the min (sidebar min = 16).
  await mockMouse.drag(gutter.x, gy, 1, gy)
  await renderOnce()

  expect(sidebar.width).toBe(16)
})

test("vertical drag resizes the main pane", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  const main = findById(renderer.root, "main") as BoxRenderable
  const gutter = findById(renderer.root, "right-split-gutter-0") as BoxRenderable

  const startHeight = main.height
  const gx = gutter.x + 4
  await mockMouse.drag(gx, gutter.y, gx, gutter.y + 4)
  await renderOnce()

  expect(main.height).toBe(startHeight + 4)
})
