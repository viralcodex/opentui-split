import { RGBA } from "@opentui/core";
import type { GutterGlyphs } from "./models.js";

export const DefaultPaneSize = 20;
export const DefaultMinSize = 4;
export const DefaultGutterColor = RGBA.fromInts(120, 200, 255);
export const DefaultGutterGlyphs: Required<GutterGlyphs> = {
  horizontal: "│",
  vertical: "─",
};
export const Transparent = RGBA.fromInts(0, 0, 0, 0);
