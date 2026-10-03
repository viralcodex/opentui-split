import { extend } from "@opentui/react";
import { SplitPaneRenderable } from "./index.js";
let registered = false;
export function registerSplitPane() {
    if (registered)
        return;
    registered = true;
    extend({ "split-pane": SplitPaneRenderable });
}
registerSplitPane();
export * from "./index.js";
//# sourceMappingURL=react.js.map