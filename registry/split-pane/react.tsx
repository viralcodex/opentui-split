import { type OptimizedBuffer, RGBA } from "@opentui/core"
import { extend } from "@opentui/react"
import { GutterRenderable, type GutterOptions, SplitPaneRenderable as SplitPaneEngine } from "opentui-split"

const GUTTER_HOVER_COLOR = RGBA.fromInts(120, 200, 255)
const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

/** Presentation half of the gutter. Draws a hairline only while hovered/grabbed. */
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

declare module "@opentui/react" {
  interface OpenTUIComponents {
    "split-pane": typeof SplitPaneRenderable
    "split-gutter": typeof SplitGutterRenderable
  }
}

export function registerSplitPane(): void {
  extend({ "split-pane": SplitPaneRenderable, "split-gutter": SplitGutterRenderable })
}

export type { SplitPaneOptions, GutterOptions, SplitDirection } from "opentui-split"
