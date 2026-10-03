import { BoxRenderable, type OptimizedBuffer, type RenderContext } from "@opentui/core";
import type { GutterOptions } from "../models.js";
/**
 * It only reports the grab (mousedown) to its SplitPane parent. The actual
 * drag is handled on the container, because a 1-cell gutter loses the cursor the
 * instant you move, and the renderer captures whatever is under the cursor at
 * the first drag event, not the element that received mousedown. The container
 * always stays in the bubble chain of the captured pane, so it keeps receiving
 * drag events.
 */
export declare class GutterRenderable extends BoxRenderable {
    private grabbed;
    private hovered;
    private readonly direction;
    private readonly glyph;
    private readonly color;
    private hairlineVisible;
    /** Cursor shown while hovering or dragging either gutter orientation. */
    private readonly resizeCursor;
    constructor(ctx: RenderContext, options: GutterOptions);
    get showHairline(): boolean;
    set showHairline(value: boolean);
    protected renderSelf(buffer: OptimizedBuffer): void;
    release(): void;
}
