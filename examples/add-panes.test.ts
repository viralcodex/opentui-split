import { test, expect, beforeEach, afterEach } from "bun:test"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { BoxRenderable, TextRenderable, type Renderable } from "@opentui/core"
import { run } from "./add-panes.ts"

let setup: TestRendererSetup

function findById(root: Renderable, id: string): Renderable | undefined {
  if (root.id === id) return root
  for (const child of root.getChildren() as Renderable[]) {
    const found = findById(child, id)
    if (found) return found
  }
  return undefined
}

/** Collect every "pane <x>" label currently in the tree. */
function paneLabels(root: Renderable): string[] {
  const out: string[] = []
  const walk = (r: Renderable) => {
    if (r instanceof TextRenderable && r.id.endsWith("-label")) {
      const text = r.content.chunks.map((c) => c.text).join("")
      if (text.startsWith("pane ")) out.push(text)
    }
    for (const c of r.getChildren() as Renderable[]) walk(c)
  }
  walk(root)
  return out
}

function splitChildrenFit(root: Renderable): boolean {
  if (root.id.endsWith("-split") && !descendantsFitShallow(root)) return false
  return root.getChildren().every((child) => splitChildrenFit(child as Renderable))
}

function descendantsFitShallow(root: Renderable): boolean {
  return root.getChildren().every((child) => {
    if (!(child instanceof BoxRenderable) || !(child.parent instanceof BoxRenderable)) return true
    const parent = child.parent
    return (
      child.x >= parent.x &&
      child.y >= parent.y &&
      child.x + child.width <= parent.x + parent.width &&
      child.y + child.height <= parent.y + parent.height
    )
  })
}

function splitPanesClip(root: Renderable): boolean {
  if (root.id.endsWith("-split")) {
    const panes = root.getChildren().filter((child) => !child.id.includes("-gutter-"))
    if (panes.some((pane) => !(pane instanceof BoxRenderable) || pane.overflow !== "hidden")) return false
  }
  return root.getChildren().every((child) => splitPanesClip(child as Renderable))
}

async function splitSlot(
  s: TestRendererSetup,
  buttonId: string,
  menuId: string,
): Promise<void> {
  const button = findById(s.renderer.root, buttonId) as BoxRenderable
  await s.mockMouse.click(button.x, button.y)
  await s.renderOnce()
  const option = findById(s.renderer.root, menuId) as BoxRenderable
  await s.mockMouse.click(option.x + 1, option.y)
  await s.renderOnce()
}

beforeEach(async () => {
  setup = await createTestRenderer({ width: 100, height: 40 })
  run(setup.renderer)
  await setup.renderOnce()
})

afterEach(() => {
  setup?.renderer.stop()
})

test("starts with a single pane", () => {
  expect(paneLabels(setup.renderer.root)).toEqual(["pane 1"])
})

test("clicking ＋ then 'Vertical' splits the pane left|right into two", async () => {
  const { renderer, mockMouse, renderOnce } = setup

  const btn = findById(renderer.root, "slot-0-add") as BoxRenderable
  await mockMouse.click(btn.x, btn.y)
  await renderOnce()

  // The orientation menu is now open.
  const vertical = findById(renderer.root, "menu-0-vertical") as BoxRenderable
  expect(vertical).toBeDefined()

  await mockMouse.click(vertical.x + 1, vertical.y)
  await renderOnce()

  // Two panes now, arranged side by side (horizontal split).
  const labels = paneLabels(renderer.root)
  expect(labels.sort()).toEqual(["pane 1", "pane 2"])

  const split = findById(renderer.root, "slot-0-split") as BoxRenderable
  expect(split).toBeDefined()
  const [a, b] = split.getChildren() as BoxRenderable[]
  expect(a.y).toBe(b.y) // same row → side by side
  expect(a.x).toBeLessThan(b.x)
})

test("clicking ＋ then 'Horizontal' stacks the pane top/bottom", async () => {
  const { renderer, mockMouse, renderOnce } = setup

  const btn = findById(renderer.root, "slot-0-add") as BoxRenderable
  await mockMouse.click(btn.x, btn.y)
  await renderOnce()

  const horizontal = findById(renderer.root, "menu-0-horizontal") as BoxRenderable
  await mockMouse.click(horizontal.x + 1, horizontal.y)
  await renderOnce()

  expect(paneLabels(renderer.root).sort()).toEqual(["pane 1", "pane 2"])

  const split = findById(renderer.root, "slot-0-split") as BoxRenderable
  const [a, b] = split.getChildren() as BoxRenderable[]
  expect(a.x).toBe(b.x) // same column → stacked
  expect(a.y).toBeLessThan(b.y)
})

test("panes can be split again, and each keeps its own ＋ button", async () => {
  const { renderer, mockMouse, renderOnce } = setup

  // First split.
  let btn = findById(renderer.root, "slot-0-add") as BoxRenderable
  await mockMouse.click(btn.x, btn.y)
  await renderOnce()
  await mockMouse.click(
    (findById(renderer.root, "menu-0-vertical") as BoxRenderable).x + 1,
    (findById(renderer.root, "menu-0-vertical") as BoxRenderable).y,
  )
  await renderOnce()

  // Split the newly created pane (slot-2 is the second child slot).
  btn = findById(renderer.root, "slot-2-add") as BoxRenderable
  expect(btn).toBeDefined()
  await mockMouse.click(btn.x, btn.y)
  await renderOnce()
  const opt = findById(renderer.root, "menu-1-horizontal") as BoxRenderable
  await mockMouse.click(opt.x + 1, opt.y)
  await renderOnce()

  expect(paneLabels(renderer.root).sort()).toEqual(["pane 1", "pane 2", "pane 3"])
})

test("clicking the backdrop dismisses the menu without splitting", async () => {
  const { renderer, mockMouse, renderOnce } = setup

  const btn = findById(renderer.root, "slot-0-add") as BoxRenderable
  await mockMouse.click(btn.x, btn.y)
  await renderOnce()
  expect(findById(renderer.root, "menu-0")).toBeDefined()

  // Click far away from the menu (top-left corner).
  await mockMouse.click(1, 1)
  await renderOnce()

  expect(findById(renderer.root, "menu-0")).toBeUndefined()
  expect(paneLabels(renderer.root)).toEqual(["pane 1"])
})

test("splits rescale their panes when the terminal resizes", async () => {
  const { renderer, mockMouse, renderOnce, resize, waitFor } = setup

  // Split into two side-by-side panes.
  const btn = findById(renderer.root, "slot-0-add") as BoxRenderable
  await mockMouse.click(btn.x, btn.y)
  await renderOnce()
  await mockMouse.click(
    (findById(renderer.root, "menu-0-vertical") as BoxRenderable).x + 1,
    (findById(renderer.root, "menu-0-vertical") as BoxRenderable).y,
  )
  await renderOnce()

  const split = findById(renderer.root, "slot-0-split") as BoxRenderable
  // Children are [paneA, gutter, paneB]; grab the two panes.
  const children = split.getChildren() as BoxRenderable[]
  const paneA = children[0]
  const paneB = children[children.length - 1]
  const beforeA = paneA.width
  const beforeB = paneB.width

  // Grow the terminal width: both panes should get wider, not just the last one.
  resize(160, 40)
  renderer.start()
  await waitFor(() => paneA.width > beforeA && paneB.width > beforeB)

  expect(paneA.width).toBeGreaterThan(beforeA)
  expect(paneB.width).toBeGreaterThan(beforeB)
})

test("deeply nested dynamic panes stay contained while resizing", async () => {
  await splitSlot(setup, "slot-0-add", "menu-0-vertical")
  await splitSlot(setup, "slot-2-add", "menu-1-horizontal")
  await splitSlot(setup, "slot-4-add", "menu-2-vertical")
  await splitSlot(setup, "slot-6-add", "menu-3-horizontal")

  const stage = findById(setup.renderer.root, "add-panes-stage") as BoxRenderable
  setup.resize(140, 50)
  setup.resize(48, 20)
  setup.resize(110, 42)
  setup.resize(30, 14)
  setup.renderer.start()
  await setup.waitFor(() => stage.width === 28 && splitChildrenFit(stage), { maxPasses: 40 })

  expect(splitPanesClip(stage)).toBe(true)
})

/** Split slot-0 into two side-by-side panes (pane 1 | pane 2). */
async function splitVertically(s: TestRendererSetup) {
  const btn = findById(s.renderer.root, "slot-0-add") as BoxRenderable
  await s.mockMouse.click(btn.x, btn.y)
  await s.renderOnce()
  const opt = findById(s.renderer.root, "menu-0-vertical") as BoxRenderable
  await s.mockMouse.click(opt.x + 1, opt.y)
  await s.renderOnce()
}

test("the sole pane has no ✕ — the last pane can't be deleted", () => {
  expect(findById(setup.renderer.root, "slot-0-del")).toBeUndefined()
})

test("clicking ✕ deletes the pane and collapses the split", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  await splitVertically(setup)
  expect(paneLabels(renderer.root).sort()).toEqual(["pane 1", "pane 2"])

  // Delete pane 2; pane 1 (its sibling) should take over the whole area.
  const del = findById(renderer.root, "slot-2-del") as BoxRenderable
  expect(del).toBeDefined()
  await mockMouse.click(del.x, del.y)
  await renderOnce()

  expect(paneLabels(renderer.root)).toEqual(["pane 1"])
  expect(findById(renderer.root, "slot-0-split")).toBeUndefined()
  // Now the sole pane again: its ✕ is stripped so it can't be deleted.
  expect(findById(renderer.root, "slot-1-del")).toBeUndefined()
})

test("the surviving pane expands to fill the space the deleted pane vacated", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  await splitVertically(setup) // pane 1 (fixed) | pane 2 (flexible)

  const stageWidth = (findById(renderer.root, "add-panes-stage") as BoxRenderable).width

  // Delete pane 2 — the FLEXIBLE pane. Pane 1 held a fixed half-width while it
  // was a pane; once it's the sole survivor it must grow to fill the whole
  // stage, not sit at its old half.
  const del = findById(renderer.root, "slot-2-del") as BoxRenderable
  await mockMouse.click(del.x, del.y)
  await renderOnce()

  const survivor = findById(renderer.root, "slot-1-leaf") as BoxRenderable
  expect(survivor.width).toBeGreaterThanOrEqual(stageWidth - 1)
})

test("deleting a pane keeps its sibling's nested split intact", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  await splitVertically(setup) // pane 1 | pane 2

  // Split pane 2 (slot-2) top/bottom → pane 2 over pane 3.
  const btn2 = findById(renderer.root, "slot-2-add") as BoxRenderable
  await mockMouse.click(btn2.x, btn2.y)
  await renderOnce()
  const opt = findById(renderer.root, "menu-1-horizontal") as BoxRenderable
  await mockMouse.click(opt.x + 1, opt.y)
  await renderOnce()
  expect(paneLabels(renderer.root).sort()).toEqual(["pane 1", "pane 2", "pane 3"])

  // Delete pane 1; its sibling is the split holding pane 2 + pane 3, which
  // should survive the collapse untouched.
  const del1 = findById(renderer.root, "slot-1-del") as BoxRenderable
  await mockMouse.click(del1.x, del1.y)
  await renderOnce()

  expect(paneLabels(renderer.root).sort()).toEqual(["pane 2", "pane 3"])
  expect(findById(renderer.root, "slot-2-split")).toBeDefined()
  expect(findById(renderer.root, "slot-0-split")).toBeUndefined()
})

test("a pane that grew by collapsing its own side is still deletable", async () => {
  const { renderer, mockMouse, renderOnce } = setup
  await splitVertically(setup) // pane 1 | pane 2

  // Split the right pane (slot-2) top/bottom, then delete the new pane so the
  // right side collapses back to one pane — now nested inside a wrapper slot.
  const btn2 = findById(renderer.root, "slot-2-add") as BoxRenderable
  await mockMouse.click(btn2.x, btn2.y)
  await renderOnce()
  const opt = findById(renderer.root, "menu-1-horizontal") as BoxRenderable
  await mockMouse.click(opt.x + 1, opt.y)
  await renderOnce()
  await mockMouse.click(
    (findById(renderer.root, "slot-4-del") as BoxRenderable).x,
    (findById(renderer.root, "slot-4-del") as BoxRenderable).y,
  )
  await renderOnce()
  expect(paneLabels(renderer.root).sort()).toEqual(["pane 1", "pane 2"])

  // pane 2 now lives nested (slot-2 > slot-3 > leaf). Its ✕ must still work —
  // deleteSlot has to climb the wrapper to find the split above it.
  const del = findById(renderer.root, "slot-3-del") as BoxRenderable
  expect(del).toBeDefined()
  await mockMouse.click(del.x, del.y)
  await renderOnce()

  expect(paneLabels(renderer.root)).toEqual(["pane 1"])
})

