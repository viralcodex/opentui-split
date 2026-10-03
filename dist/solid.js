import { LayoutSlotRenderable } from "@opentui/solid";
import { extend } from "@opentui/solid/components";
import { SplitPaneRenderable } from "./index.js";
class SolidSplitPaneRenderable extends SplitPaneRenderable {
    isAuxiliaryChild(obj) {
        return obj instanceof LayoutSlotRenderable;
    }
}
let registered = false;
export function registerSplitPane() {
    if (registered)
        return;
    registered = true;
    extend({ split_pane: SolidSplitPaneRenderable });
}
registerSplitPane();
export * from "./index.js";
//# sourceMappingURL=solid.js.map