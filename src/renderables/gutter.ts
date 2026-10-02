import {
  BoxRenderable,
  MouseButton,
  type MouseEvent,
  type MousePointerStyle,
  type OptimizedBuffer,
  parseColor,
  type RGBA,
  type RenderContext,
} from "@opentui/core";
import { DefaultGutterColor, DefaultGutterGlyphs, Transparent } from "../constants.js";
import type { GutterOptions, SplitDirection } from "../models.js";

/**
 * Thin divider between two panes.
 *
 * It only reports the grab (mousedown) to its SplitPane parent. The actual
 * drag is handled on the container, because a 1-cell gutter loses the cursor the
 * instant you move, and the renderer captures whatever is under the cursor at
 * the first drag event, not the element that received mousedown. The container
 * always stays in the bubble chain of the captured pane, so it keeps receiving
 * drag events.
 */
export class GutterRenderable extends BoxRenderable {
  private grabbed = false;
  private hovered = false;
  private readonly direction: SplitDirection;
  private readonly glyph: string;
  private readonly color: RGBA;
  private hairlineVisible: boolean;
  /** Cursor shown while hovering or dragging either gutter orientation. */
  private readonly resizeCursor: MousePointerStyle;

  constructor(ctx: RenderContext, options: GutterOptions) {
    const { direction, onGrab, visible, glyphs, color, ...boxOptions } = options;
    super(ctx, {
      ...boxOptions,
      flexShrink: 0,
      backgroundColor: "transparent",
    });

    this.direction = direction;
    this.glyph = glyphs?.[direction] ?? DefaultGutterGlyphs[direction];
    this.color = color === undefined ? DefaultGutterColor : parseColor(color);
    this.hairlineVisible = visible ?? true;
    this.resizeCursor = "crosshair";

    this.onMouseDown = (event: MouseEvent) => {
      if (event.button !== MouseButton.LEFT) return;
      event.stopPropagation();
      event.preventDefault();
      this.grabbed = true;
      ctx.setMousePointer(this.resizeCursor);
      this.requestRender();
      onGrab(event);
    };

    // Clear the grab highlight once the container ends the drag.
    this.onMouseUp = () => this.release();

    this.onMouseDragEnd = () => this.release();

    this.onMouseOver = () => {
      this.hovered = true;
      ctx.setMousePointer(this.resizeCursor);
      this.requestRender();
    };
    this.onMouseOut = () => {
      this.hovered = false;
      // Keep the move cursor while dragging even after the pointer leaves the
      // 1-cell gutter; only reset once the gesture ends.
      if (!this.grabbed) {
        ctx.setMousePointer("default");
        this.requestRender();
      }
    };
  }

  get showHairline(): boolean {
    return this.hairlineVisible;
  }

  set showHairline(value: boolean) {
    if (value === this.hairlineVisible) return;
    this.hairlineVisible = value;
    this.requestRender();
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    if (!this.hairlineVisible) return;

    if (this.direction === "horizontal") {
      for (let y = 0; y < this.height; y++) {
        buffer.setCellWithAlphaBlending(this.x, this.y + y, this.glyph, this.color, Transparent);
      }
    } else {
      for (let x = 0; x < this.width; x++) {
        buffer.setCellWithAlphaBlending(this.x + x, this.y, this.glyph, this.color, Transparent);
      }
    }
  }

  /** Reset grab state. Called by the parent when a drag ends. */
  release(): void {
    this.grabbed = false;
    this._ctx.setMousePointer(this.hovered ? this.resizeCursor : "default");
    this.requestRender();
  }
}
