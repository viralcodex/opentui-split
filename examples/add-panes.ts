// Add and remove nested panes at runtime. Use Tab to focus, Ctrl-drag or
// Alt-arrow to reorder, g to toggle gutters, and h to toggle all controls.

import {
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  RGBA,
  TextRenderable,
} from "@opentui/core";
import type { SplitDirection } from "../src/index.ts";
import {
  bindDemoKeys,
  bindKeys,
  bindPaneControls,
  isModifiedKey,
  openMenu,
  PaneLayout,
} from "./pane-layout.ts";

const Colors = {
  background: RGBA.fromInts(10, 12, 17),
  pane: RGBA.fromInts(13, 15, 21),
  border: RGBA.fromInts(44, 50, 64),
  text: RGBA.fromInts(226, 232, 240),
  accent: RGBA.fromInts(96, 165, 250),
  accentText: RGBA.fromInts(8, 12, 20),
  danger: RGBA.fromInts(239, 110, 110),
  dangerText: RGBA.fromInts(20, 10, 12),
  menu: RGBA.fromInts(18, 22, 32),
  menuHover: RGBA.fromInts(34, 52, 82),
} as const;

class AddPaneLayout extends PaneLayout<number> {
  private nextPane = 1;
  private closeMenu?: () => void;

  start(): void {
    this.seed(this.nextPane);
  }

  dispose(): void {
    this.closeMenu?.();
  }

  protected fillLeaf(slot: BoxRenderable, pane: number, deletable: boolean): void {
    const leaf = new BoxRenderable(this.renderer, {
      id: `${slot.id}-leaf`,
      width: "100%",
      height: "100%",
      flexGrow: 1,
      border: true,
      borderStyle: "rounded",
      borderColor: Colors.border,
      focusedBorderColor: Colors.accent,
      focusable: true,
      backgroundColor: Colors.pane,
      justifyContent: "center",
      alignItems: "center",
    });
    leaf.add(
      new TextRenderable(this.renderer, {
        id: `${slot.id}-label`,
        content: `pane ${pane}`,
        fg: Colors.text,
      }),
    );
    this.addButton(leaf, {
      id: `${slot.id}-add`,
      icon: "＋",
      corner: "bottom-right",
      background: Colors.accent,
      foreground: Colors.accentText,
      onPress: () => this.showMenu(slot),
    });
    if (deletable) {
      this.addButton(leaf, {
        id: `${slot.id}-del`,
        icon: "✕",
        corner: "top-right",
        background: Colors.danger,
        foreground: Colors.dangerText,
        onPress: () => this.deleteSlot(slot),
      });
    }
    slot.add(leaf);
  }

  private showMenu(slot: BoxRenderable): void {
    this.closeMenu?.();
    const anchor = slot.findDescendantById(`${slot.id}-add`);
    if (!(anchor instanceof BoxRenderable)) return;

    const split = (direction: SplitDirection): void => {
      this.split(slot, direction, ++this.nextPane);
    };
    this.closeMenu = openMenu(
      this.renderer,
      anchor,
      [
        {
          id: "add-menu-vertical",
          label: "│  Vertical",
          color: Colors.text,
          onSelect: () => split("horizontal"),
        },
        {
          id: "add-menu-horizontal",
          label: "─  Horizontal",
          color: Colors.text,
          onSelect: () => split("vertical"),
        },
      ],
      {
        id: "add-menu",
        width: 20,
        borderColor: Colors.accent,
        backgroundColor: Colors.menu,
        hoverColor: Colors.menuHover,
        rounded: true,
      },
    );
  }
}

const sessions = new WeakMap<CliRenderer, () => void>();

export function run(renderer: CliRenderer): void {
  destroy(renderer);
  renderer.start();
  renderer.setBackgroundColor(Colors.background);

  const root = new BoxRenderable(renderer, {
    id: "add-panes-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 1,
    flexGrow: 1,
  });
  const stage = new BoxRenderable(renderer, {
    id: "add-panes-stage",
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    marginTop: 1,
  });
  root.add(stage);
  renderer.root.add(root);

  const layout = new AddPaneLayout(renderer, stage, 6);
  layout.start();
  const unbindControls = bindPaneControls(renderer);
  const unbindKeys = bindKeys(renderer, (key) => {
    if (isModifiedKey(key)) return;
    if (key.name === "g") layout.toggleGutters();
    else if (key.name === "h") layout.toggleChrome();
  });
  sessions.set(renderer, () => {
    unbindKeys();
    unbindControls();
    layout.dispose();
  });
}

export function destroy(renderer: CliRenderer): void {
  sessions.get(renderer)?.();
  sessions.delete(renderer);
  renderer.root.getRenderable("add-panes-root")?.destroyRecursively();
}

if (import.meta.main) {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  run(renderer);
  bindDemoKeys(renderer);
}
