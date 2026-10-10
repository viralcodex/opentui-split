import { BoxRenderable, MouseButton, parseColor, } from "@opentui/core";
import { DefaultGutterColor, DefaultGutterGlyphs, Transparent } from "../constants.js";
export class GutterRenderable extends BoxRenderable {
    grabbed = false;
    hovered = false;
    direction;
    glyph;
    color;
    hairlineVisible;
    constructor(ctx, options) {
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
        this.onMouseDown = (event) => {
            if (event.button !== MouseButton.LEFT)
                return;
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
    get showHairline() {
        return this.hairlineVisible;
    }
    set showHairline(value) {
        if (value === this.hairlineVisible)
            return;
        this.hairlineVisible = value;
        this.requestRender();
    }
    renderSelf(buffer) {
        if (!this.hairlineVisible)
            return;
        if (this.direction === "horizontal") {
            for (let y = 0; y < this.height; y++) {
                buffer.setCellWithAlphaBlending(this.x, this.y + y, this.glyph, this.color, Transparent);
            }
        }
        else {
            for (let x = 0; x < this.width; x++) {
                buffer.setCellWithAlphaBlending(this.x + x, this.y, this.glyph, this.color, Transparent);
            }
        }
    }
    release() {
        this.grabbed = false;
        this._ctx.setMousePointer(this.hovered ? "crosshair" : "default");
        this.requestRender();
    }
}
//# sourceMappingURL=gutter.js.map