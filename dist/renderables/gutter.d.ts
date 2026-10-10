import { BoxRenderable, type OptimizedBuffer, type RenderContext } from "@opentui/core";
import type { GutterOptions } from "../models.js";
export declare class GutterRenderable extends BoxRenderable {
    private grabbed;
    private hovered;
    private readonly direction;
    private readonly glyph;
    private readonly color;
    private hairlineVisible;
    constructor(ctx: RenderContext, options: GutterOptions);
    get showHairline(): boolean;
    set showHairline(value: boolean);
    protected renderSelf(buffer: OptimizedBuffer): void;
    release(): void;
}
