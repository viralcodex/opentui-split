import { BoxRenderable, MouseButton, parseColor, } from "@opentui/core";
import { DefaultGutterColor, DefaultGutterGlyphs, Transparent } from "../constants.js";
/**
 * It only reports the grab (mousedown) to its SplitPane parent. The actual
 * drag is handled on the container, because a 1-cell gutter loses the cursor the
 * instant you move, and the renderer captures whatever is under the cursor at
 * the first drag event, not the element that received mousedown. The container
 * always stays in the bubble chain of the captured pane, so it keeps receiving
 * drag events.
 */
export class GutterRenderable extends BoxRenderable {
    grabbed = false;
    hovered = false;
    direction;
    glyph;
    color;
    hairlineVisible;
    /** Cursor shown while hovering or dragging either gutter orientation. */
    resizeCursor;
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
        this.resizeCursor = "crosshair";
        this.onMouseDown = (event) => {
            if (event.button !== MouseButton.LEFT)
                return;
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
        this._ctx.setMousePointer(this.hovered ? this.resizeCursor : "default");
        this.requestRender();
    }
}
//# sourceMappingURL=gutter.js.map