import type { BoxOptions, MouseEvent, RGBA } from "@opentui/core";

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
