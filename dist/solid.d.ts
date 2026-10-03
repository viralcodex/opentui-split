import { SplitPaneRenderable } from "./index.js";
declare module "@opentui/solid" {
    interface OpenTUIComponents {
        split_pane: typeof SplitPaneRenderable;
    }
}
export declare function registerSplitPane(): void;
export * from "./index.js";
