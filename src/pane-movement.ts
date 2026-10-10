import type { CliRenderer } from "@opentui/core";
import type { PaneMovement, PaneMovementOptions } from "./models.js";
import { createPaneDragDrop } from "./pane-dragdrop.js";
import { createPaneReorder } from "./pane-reorder.js";

export function createPaneMovement(
  renderer: CliRenderer,
  options: PaneMovementOptions = {},
): PaneMovement {
  const dragDrop = createPaneDragDrop(renderer, options);
  const reorder = createPaneReorder(renderer, options);

  return {
    get dragging() {
      return dragDrop.dragging;
    },
    move: reorder.move,
    dispose: () => {
      dragDrop.dispose();
      reorder.dispose();
    },
  };
}
