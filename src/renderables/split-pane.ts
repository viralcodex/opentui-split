import { BoxRenderable, type BoxOptions, type MouseEvent, type RenderContext } from "@opentui/core"
import { GutterRenderable, type GutterOptions, type SplitDirection } from "./gutter.js"

export interface SplitPaneOptions extends BoxOptions {
  direction?: SplitDirection
  sizes?: number[]
  minSizes?: number[]
  gutterSize?: number
  onResize?: (sizes: number[]) => void
}

/**
 * Arranges child panes along one axis with draggable gutters between them.
 * Add panes with `addPane()` before the first layout pass.
 *
 * This is the ENGINE container: it owns drag and size-conservation math. It
 * builds invisible engine gutters by default; a skin overrides `createGutter()`
 * to supply gutters that draw themselves.
 */
export class SplitPaneRenderable extends BoxRenderable {
  private readonly direction: SplitDirection
  private readonly gutterSize: number
  private readonly resizeCallback: ((sizes: number[]) => void) | undefined

  private panes: BoxRenderable[] = []
  private gutters: GutterRenderable[] = []
  private sizes: number[]
  private minSizes: number[]
  private pendingSizes: number[]
  private pendingMins: number[]
  private activeGutter = -1 // gutter index currently being dragged
  private startX = 0
  private startY = 0
  private dragLeftBasis = 0
  private dragRightBasis = 0
  // Last layout size we scaled against, so a resize can grow/shrink every fixed
  // pane proportionally instead of dumping the whole delta on the last one.
  private lastLayoutWidth = 0
  private lastLayoutHeight = 0

  constructor(ctx: RenderContext, options: SplitPaneOptions) {
    const direction = options.direction ?? "horizontal"
    super(ctx, {
      ...options,
      flexDirection: direction === "horizontal" ? "row" : "column",
    })
    this.direction = direction
    this.gutterSize = options.gutterSize ?? 1
    this.resizeCallback = options.onResize
    this.pendingSizes = options.sizes ? [...options.sizes] : []
    this.pendingMins = options.minSizes ? [...options.minSizes] : []
    this.sizes = []
    this.minSizes = []
    this.setupDragHandling()
    this.lastLayoutWidth = this.width
    this.lastLayoutHeight = this.height
  }

  /** True when panes are laid out left-to-right (gutters are vertical hairlines). */
  private get isHorizontal(): boolean {
    return this.direction === "horizontal"
  }

  /** Read the coordinate (x or y) that moves the active gutter. */
  private axisCoord(event: MouseEvent): number {
    return this.isHorizontal ? event.x : event.y
  }

  /** Write a pane's extent along the split axis without touching the cross axis. */
  private writeExtent(pane: BoxRenderable, size: number): void {
    if (this.isHorizontal) {
      pane.width = size
    } else {
      pane.height = size
    }
  }

  protected onResize(width: number, height: number): void {
    super.onResize(width, height)
    this.handleLayoutResize(width, height)
  }

  protected createGutter(options: GutterOptions): GutterRenderable {
    return new GutterRenderable(this._ctx, options)
  }

  // The container handles the drag, not the gutter: a 1-cell gutter loses the
  // cursor immediately, so the renderer ends up capturing a neighbouring pane.
  // That pane bubbles its drag/up events up to this container, which stays in
  // the chain for the whole gesture.
  private setupDragHandling(): void {
    this.onMouseDrag = (event: MouseEvent) => {
      if (this.activeGutter < 0) return
      event.stopPropagation()
      const start = this.isHorizontal ? this.startX : this.startY
      this.applyDrag(this.activeGutter, this.axisCoord(event) - start)
    }

    const end = (event: MouseEvent) => {
      if (this.activeGutter < 0) return
      event.stopPropagation()
      // Reset the dragged gutter (its own onMouseUp may not fire once the pointer
      // has left the 1-cell strip) and restore its pointer for the hover state.
      this.gutters[this.activeGutter]?.release()
      this.activeGutter = -1
    }
    this.onMouseUp = end
    this.onMouseDragEnd = end
  }

  private grabGutter(gutterIndex: number, event: MouseEvent): void {
    this.activeGutter = gutterIndex
    this.startX = event.x
    this.startY = event.y
    this.captureBasis(gutterIndex)
  }

  // Capture the fixed pane's basis and the neighbour's *actual* rendered size
  // (works whether the neighbour is fixed or the flexible last pane).
  private captureBasis(gutterIndex: number): void {
    this.sizes = this.panes.map((_, index) => this.paneSize(index))
    this.dragLeftBasis = this.paneSize(gutterIndex)
    this.dragRightBasis = this.paneSize(gutterIndex + 1)
  }

  private paneSize(index: number): number {
    if (index < 0 || index >= this.panes.length) return 0
    const pane = this.panes[index] ?? { width: 0, height: 0 }
    return this.isHorizontal ? pane.width : pane.height
  }

  // Every pane but the last is fixed-size and draggable; the last pane flexes to
  // fill whatever space remains, so the split always fills its container.
  private applySizing(): void {
    const lastIndex = this.panes.length - 1

    this.panes.forEach((pane, index) => {
      const isLast = index === lastIndex

      pane.flexGrow = Number(isLast)
      pane.flexShrink = Number(isLast)
      pane.overflow = "hidden"

      if (this.isHorizontal) {
        pane.width = isLast ? "auto" : this.sizes[index] ?? 0
      } else {
        pane.height = isLast ? "auto" : this.sizes[index] ?? 0
      }
    })
  }

  private applyBasis(index: number): void {
    const pane = this.panes[index]
    if (!pane) return
    this.writeExtent(pane, this.sizes[index] ?? 0)
  }

  // Scale all panes to the space left after gutters. Minimums constrain direct
  // dragging, but cannot be hard layout constraints when the container itself
  // becomes smaller than their sum.
  private handleLayoutResize(width: number, height: number): void {
    const prev = this.isHorizontal ? this.lastLayoutWidth : this.lastLayoutHeight
    const next = this.isHorizontal ? width : height
    this.lastLayoutWidth = width
    this.lastLayoutHeight = height
    if (prev <= 0 || next === prev) return

    const lastIndex = this.panes.length - 1
    if (lastIndex < 0) return

    const gutterSpace = this.gutters.length * this.gutterSize
    const previousAvailable = Math.max(0, prev - gutterSpace)
    const nextAvailable = Math.max(0, next - gutterSpace)
    const fixedTotal = this.panes
      .slice(0, lastIndex)
      .reduce((total, _, index) => total + this.paneSize(index), 0)
    const previousSizes = this.panes.map((_, index) =>
      index === lastIndex ? Math.max(0, previousAvailable - fixedTotal) : this.paneSize(index),
    )
    const previousTotal = previousSizes.reduce((total, size) => total + size, 0)
    if (previousTotal <= 0) return

    const ratio = nextAvailable / previousTotal
    this.sizes = previousSizes.map((size) => size * ratio)

    for (let index = 0; index < lastIndex; index++) this.applyBasis(index)

    if (lastIndex > 0) {
      queueMicrotask(() => {
        if (!this.isDestroyed) this.requestRender()
      })
      this.resizeCallback?.([...this.sizes])
    }
  }

  private applyDrag(gutterIndex: number, delta: number): void {
    const left = gutterIndex
    const right = gutterIndex + 1
    const lastIndex = this.panes.length - 1
    const total = this.dragLeftBasis + this.dragRightBasis
    const minL = this.minSizes[left] ?? 0
    const minR = this.minSizes[right] ?? 0

    if (total < minL + minR) return

    let newLeft = this.dragLeftBasis + delta
    newLeft = Math.max(minL, Math.min(total - minR, newLeft))
    if (newLeft === this.sizes[left]) return

    this.sizes[left] = newLeft
    this.applyBasis(left)
    this.sizes[right] = total - newLeft
    // If the right neighbour is a fixed pane, it gives up what left gained.
    // If it's the flexible last pane, flexGrow absorbs the change automatically.
    if (right !== lastIndex) {
      this.applyBasis(right)
    }
    this.requestRender()
    this.resizeCallback?.([...this.sizes])
  }


  addPane(pane: BoxRenderable, size?: number, minSize?: number): void {
    const index = this.panes.length
    this.panes.push(pane)
    this.sizes.push(size ?? this.pendingSizes[index] ?? 20)
    this.minSizes.push(minSize ?? this.pendingMins[index] ?? 4)

    // Insert a gutter before every pane except the first.
    if (index > 0) {
      const gutterIndex = index - 1
      const gutter = this.createGutter({
        id: `${this.id}-gutter-${gutterIndex}`,
        direction: this.direction,
        width: this.isHorizontal ? this.gutterSize : "auto",
        height: this.isHorizontal ? "auto" : this.gutterSize,
        onGrab: (event) => this.grabGutter(gutterIndex, event),
      })
      this.gutters.push(gutter)
      this.add(gutter)
    }
    this.add(pane)
    this.applySizing()
  }
}
