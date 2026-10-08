import type { BaseRenderable, BoxOptions, KeyEvent, MouseEvent, Renderable, RGBA } from "@opentui/core";
export type SplitDirection = "horizontal" | "vertical";
export interface GutterGlyphs {
    horizontal?: string;
    vertical?: string;
}
export interface SplitPaneGutterOptions {
    visible?: boolean;
    glyphs?: GutterGlyphs;
    color?: RGBA | string;
}
export interface GutterOptions extends Pick<BoxOptions, "id" | "width" | "height"> {
    direction: SplitDirection;
    onGrab: (event: MouseEvent) => void;
    visible?: boolean;
    glyphs?: GutterGlyphs;
    color?: RGBA | string;
}
export interface SplitPaneOptions extends BoxOptions {
    direction?: SplitDirection;
    sizes?: number[];
    minSizes?: number[];
    gutterSize?: number;
    onSizesChange?: (sizes: number[]) => void;
    gutterOptions?: SplitPaneGutterOptions;
}
export type PaneNavigation = "next" | "previous";
export type PaneNavigatorKeymap = (event: KeyEvent) => PaneNavigation | undefined;
export interface PaneNavigatorOptions {
    root?: BaseRenderable;
    keymap?: PaneNavigatorKeymap | false;
    wrap?: boolean;
    isPane?: (renderable: Renderable) => boolean;
    onFocusChange?: (current: Renderable, previous: Renderable | null) => void;
}
export interface PaneNavigator {
    readonly panes: Renderable[];
    readonly current: Renderable | null;
    focusNext(): void;
    focusPrevious(): void;
    focusPane(target: number | Renderable): void;
    dispose(): void;
}
