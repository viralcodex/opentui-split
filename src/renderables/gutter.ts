import {
  BoxRenderable,
  MouseButton,
  type BoxOptions,
  type MouseEvent,
  type MousePointerStyle,
  type RenderContext,
} from "@opentui/core"

export type SplitDirection = "horizontal" | "vertical"

export interface GutterOptions extends BoxOptions {
  direction: SplitDirection
  onGrab: (event: MouseEvent) => void
}

/**
 * Thin divider between two panes — the ENGINE half of the gutter.
 *
 * It only reports the grab (mousedown) to its SplitPane parent — the actual
 * drag is handled on the container, because a 1-cell gutter loses the cursor the
 * instant you move, and the renderer captures whatever is under the cursor at
 * the first drag event, not the element that received mousedown. The container
 * always stays in the bubble chain of the captured pane, so it keeps receiving
 * drag events.
 *
 * This base class owns mouse plumbing and interaction state ONLY. It draws
 * nothing: presentation (glyphs, colours, the hover-only rendering) belongs to a
 * skin subclass that overrides `renderSelf`.
 */
export class GutterRenderable extends BoxRenderable {
  protected grabbed = false
  protected hovered = false
  protected readonly dir: SplitDirection
  /** Cursor shown while hovering or dragging either gutter orientation. */
  protected readonly resizeCursor: MousePointerStyle

  constructor(ctx: RenderContext, options: GutterOptions) {
    super(ctx, {
      ...options,
      flexShrink: 0,
      backgroundColor: "transparent",
    })

    this.dir = options.direction
    this.resizeCursor = "crosshair"

    this.onMouseDown = (event: MouseEvent) => {
      if (event.button !== MouseButton.LEFT) return
      event.stopPropagation()
      event.preventDefault()
      this.grabbed = true
      ctx.setMousePointer(this.resizeCursor)
      this.requestRender()
      options.onGrab(event)
    }

    // Clear the grab highlight once the container ends the drag.
    this.onMouseUp = () => this.release()

    this.onMouseDragEnd = () => this.release()

    this.onMouseOver = () => {
      this.hovered = true
      ctx.setMousePointer(this.resizeCursor)
      this.requestRender()
    }
    this.onMouseOut = () => {
      this.hovered = false
      // Keep the move cursor while dragging even after the pointer leaves the
      // 1-cell gutter; only reset once the gesture ends.
      if (!this.grabbed) {
        ctx.setMousePointer("default")
        this.requestRender()
      }
    }
  }

  /** Reset grab state. Called by the parent when a drag ends. */
  release(): void {
    this.grabbed = false
    this._ctx.setMousePointer(this.hovered ? this.resizeCursor : "default")
    this.requestRender()
  }
}
