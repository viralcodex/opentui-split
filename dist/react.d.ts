import { SplitPaneRenderable } from "./index.js";
declare module "@opentui/react" {
    interface OpenTUIComponents {
        "split-pane": typeof SplitPaneRenderable;
    }
}
export declare function registerSplitPane(): void;
export * from "./index.js";
