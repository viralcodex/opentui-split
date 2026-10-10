import type { BaseRenderable, BoxRenderable, BoxOptions, KeyEvent, MouseEvent, Renderable, RGBA } from "@opentui/core";
import type { SplitPaneRenderable } from "./renderables/split-pane.js";
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
export type PaneDragModifier = "alt" | "ctrl" | "shift";
export type PanePredicate = (pane: BoxRenderable) => boolean;
export type PaneReorderCallback = (split: SplitPaneRenderable, from: number, to: number) => void;
export type PaneSwapCallback = (first: BoxRenderable, second: BoxRenderable) => void;
export type PaneMoveDirection = "left" | "right" | "up" | "down";
export type PaneReorderKeymap = (event: KeyEvent) => PaneMoveDirection | undefined;
export interface PaneMovementOptions {
    root?: Renderable;
    modifier?: PaneDragModifier | false;
    isPane?: PanePredicate;
    handle?: (target: Renderable, pane: BoxRenderable) => boolean;
    keymap?: PaneReorderKeymap | false;
    onReorder?: PaneReorderCallback;
    onSwap?: PaneSwapCallback;
}
export interface PaneMovement {
    readonly dragging: boolean;
    move(direction: PaneMoveDirection): boolean;
    dispose(): void;
}
export type PaneDragDropOptions = Omit<PaneMovementOptions, "keymap">;
export type PaneReorderOptions = Omit<PaneMovementOptions, "modifier" | "handle">;
export type PaneDragDrop = Pick<PaneMovement, "dragging" | "dispose">;
export type PaneReorder = Pick<PaneMovement, "move" | "dispose">;
