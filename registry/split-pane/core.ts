import { type OptimizedBuffer, type RenderContext, RGBA } from "@opentui/core"
import { GutterRenderable, type GutterOptions, SplitPaneRenderable as SplitPaneEngine } from "opentui-split"

/** Colour the gutter shows while hovered or dragged. Edit freely. */
const GUTTER_HOVER_COLOR = RGBA.fromInts(120, 200, 255)
const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

export class SplitGutterRenderable extends GutterRenderable {
  protected renderSelf(buffer: OptimizedBuffer): void {
    const active = this.hovered || this.grabbed
    if (!active) return
    const color = GUTTER_HOVER_COLOR
    if (this.dir === "horizontal") {
      for (let y = 0; y < this.height; y++) {
        buffer.setCellWithAlphaBlending(this.x, this.y + y, "│", color, TRANSPARENT)
      }
    } else {
      for (let x = 0; x < this.width; x++) {
        buffer.setCellWithAlphaBlending(this.x + x, this.y, "─", color, TRANSPARENT)
      }
    }
  }
}


export class SplitPaneRenderable extends SplitPaneEngine {
  protected createGutter(options: GutterOptions): GutterRenderable {
    return new SplitGutterRenderable(this._ctx, options)
  }
}

export type { SplitPaneOptions, GutterOptions, SplitDirection } from "opentui-split"

/** Re-exported so callers can construct panes in the same import. */
export { SplitPaneRenderable as SplitPane }
export type { RenderContext }
