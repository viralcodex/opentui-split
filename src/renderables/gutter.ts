import {
  BoxRenderable,
  MouseButton,
  type MouseEvent,
  type OptimizedBuffer,
  parseColor,
  type RGBA,
  type RenderContext,
} from "@opentui/core";
import { DefaultGutterColor, DefaultGutterGlyphs, Transparent } from "../constants.js";
import type { GutterOptions, SplitDirection } from "../models.js";

export class GutterRenderable extends BoxRenderable {
  private grabbed = false;
  private hovered = false;
  private readonly direction: SplitDirection;
  private readonly glyph: string;
  private readonly color: RGBA;
  private hairlineVisible: boolean;

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

    this.onMouseDown = (event: MouseEvent) => {
      if (event.button !== MouseButton.LEFT) return;
      event.stopPropagation();
      event.preventDefault();
      this.grabbed = true;
      ctx.setMousePointer("crosshair");
      this.requestRender();
      onGrab(event);
    };

    this.onMouseUp = () => this.release();

    this.onMouseDragEnd = () => this.release();

    this.onMouseOver = () => {
      this.hovered = true;
      ctx.setMousePointer("crosshair");
      this.requestRender();
    };
    this.onMouseOut = () => {
      this.hovered = false;
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

  release(): void {
    this.grabbed = false;
    this._ctx.setMousePointer(this.hovered ? "crosshair" : "default");
    this.requestRender();
  }
}
