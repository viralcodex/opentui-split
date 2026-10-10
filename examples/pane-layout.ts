import {
  BoxRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
  RGBA,
  TextRenderable,
} from "@opentui/core";
import {
  createPaneMovement,
  createPaneNavigator,
  type PaneMovementOptions,
  type SplitDirection,
  SplitPaneRenderable,
} from "../src/index.ts";

export interface IconButtonOptions {
  id: string;
  icon: string;
  corner: "top-right" | "bottom-right";
  background: RGBA;
  foreground: RGBA;
  onPress: () => void;
}

export interface MenuItem {
  id: string;
  label: string;
  color: RGBA;
  onSelect: () => void;
}

export interface MenuStyle {
  id: string;
  width: number;
  borderColor: RGBA;
  backgroundColor: RGBA;
  hoverColor: RGBA;
  rounded?: boolean;
}

export interface SplitResult {
  kept: BoxRenderable;
  added: BoxRenderable;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const isSlot = (value: unknown): value is BoxRenderable =>
  value instanceof BoxRenderable && /^slot-\d+$/.test(value.id);

function pointer(renderer: CliRenderer, box: BoxRenderable): void {
  box.onMouseOver = () => renderer.setMousePointer("pointer");
  box.onMouseOut = () => renderer.setMousePointer("default");
}

function iconButton(renderer: CliRenderer, options: IconButtonOptions): BoxRenderable {
  const button = new BoxRenderable(renderer, {
    id: options.id,
    position: "absolute",
    right: 0,
    ...(options.corner === "bottom-right" ? { bottom: 0 } : { top: 0 }),
    backgroundColor: options.background,
    paddingLeft: 1,
    paddingRight: 1,
    zIndex: 10,
  });
  button.add(
    new TextRenderable(renderer, {
      id: `${options.id}-icon`,
      content: options.icon,
      fg: options.foreground,
    }),
  );
  button.onMouseDown = (event: MouseEvent) => {
    event.stopPropagation();
    options.onPress();
  };
  pointer(renderer, button);
  return button;
}

export function openMenu(
  renderer: CliRenderer,
  anchor: BoxRenderable,
  items: MenuItem[],
  style: MenuStyle,
): () => void {
  const height = items.length + 2;
  const backdrop = new BoxRenderable(renderer, {
    id: `${style.id}-backdrop`,
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 1000,
  });
  const menu = new BoxRenderable(renderer, {
    id: style.id,
    position: "absolute",
    left: clamp(anchor.x - style.width + 3, 0, renderer.width - style.width),
    top: clamp(anchor.y < height ? anchor.y + 1 : anchor.y - height, 0, renderer.height - height),
    width: style.width,
    zIndex: 1001,
    border: true,
    borderStyle: style.rounded ? "rounded" : "single",
    borderColor: style.borderColor,
    backgroundColor: style.backgroundColor,
    flexDirection: "column",
  });

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    backdrop.destroyRecursively();
    menu.destroyRecursively();
    renderer.setMousePointer("default");
    renderer.requestRender();
  };

  backdrop.onMouseDown = (event: MouseEvent) => {
    event.stopPropagation();
    close();
  };
  for (const item of items) {
    const row = new BoxRenderable(renderer, {
      id: item.id,
      width: "100%",
      height: 1,
      paddingLeft: 1,
      backgroundColor: "transparent",
    });
    row.add(
      new TextRenderable(renderer, {
        id: `${item.id}-label`,
        content: item.label,
        fg: item.color,
      }),
    );
    row.onMouseDown = (event: MouseEvent) => {
      event.stopPropagation();
      close();
      item.onSelect();
    };
    row.onMouseOver = () => {
      row.backgroundColor = style.hoverColor;
      renderer.setMousePointer("pointer");
    };
    row.onMouseOut = () => {
      row.backgroundColor = "transparent";
      renderer.setMousePointer("default");
    };
    menu.add(row);
  }

  renderer.root.add(backdrop);
  renderer.root.add(menu);
  renderer.requestRender();
  return close;
}

export abstract class PaneLayout<T> {
  private slotSequence = 0;
  private readonly splits = new Set<SplitPaneRenderable>();
  private readonly buttons = new Set<BoxRenderable>();
  private guttersVisible = true;
  private chromeVisible = true;
  protected readonly values = new Map<BoxRenderable, T>();

  constructor(
    protected readonly renderer: CliRenderer,
    private readonly stage: BoxRenderable,
    private readonly minPane: number,
  ) {}

  protected abstract fillLeaf(slot: BoxRenderable, value: T, deletable: boolean): void;

  protected onLeafRemoved(_slot: BoxRenderable): void {}

  seed(value: T): BoxRenderable {
    const slot = this.createSlot(value, false);
    this.stage.add(slot);
    return slot;
  }

  split(
    slot: BoxRenderable,
    direction: SplitDirection,
    value: T,
    ratio = 0.5,
    spanHint = 0,
  ): SplitResult | null {
    const keptValue = this.values.get(slot);
    if (keptValue === undefined) return null;

    for (const child of slot.getChildren()) child.destroyRecursively();
    this.values.delete(slot);
    this.onLeafRemoved(slot);

    const span = this.spanFor(slot, direction, spanHint);
    const firstSize = clamp(
      Math.floor(span * clamp(ratio, 0.2, 0.8)),
      this.minPane,
      span - this.minPane - 1,
    );
    const split = new SplitPaneRenderable(this.renderer, {
      id: `${slot.id}-split`,
      direction,
      width: "100%",
      height: "100%",
      flexGrow: 1,
    });
    split.setGutterVisible(this.chromeVisible && this.guttersVisible);
    this.splits.add(split);

    const kept = this.createSlot(keptValue, true);
    const added = this.createSlot(value, true);
    split.addPane(kept, firstSize, this.minPane);
    split.addPane(added, span - firstSize - 1, this.minPane);
    slot.add(split);
    this.renderer.requestRender();
    return { kept, added };
  }

  toggleGutters(): void {
    this.guttersVisible = !this.guttersVisible;
    this.applyGutters();
  }

  toggleChrome(): void {
    this.chromeVisible = !this.chromeVisible;
    for (const button of this.buttons) button.visible = this.chromeVisible;
    this.applyGutters();
  }

  protected addButton(leaf: BoxRenderable, options: IconButtonOptions): void {
    const button = iconButton(this.renderer, options);
    button.visible = this.chromeVisible;
    this.buttons.add(button);
    button.once("destroyed", () => this.buttons.delete(button));
    leaf.add(button);
  }

  protected deleteSlot(leafSlot: BoxRenderable): void {
    let slot = leafSlot;
    while (isSlot(slot.parent)) slot = slot.parent;

    const split = slot.parent;
    if (!(split instanceof SplitPaneRenderable)) return;
    const parentSlot = split.parent;
    if (!(parentSlot instanceof BoxRenderable)) return;
    const sibling = split.paneList.find((pane) => pane !== slot && isSlot(pane));
    if (!sibling) return;

    split.remove(sibling);
    parentSlot.remove(split);
    this.splits.delete(split);
    split.destroyRecursively();
    this.values.delete(leafSlot);
    this.onLeafRemoved(leafSlot);

    sibling.width = "100%";
    sibling.height = "100%";
    sibling.flexGrow = 1;
    sibling.flexShrink = 1;
    parentSlot.add(sibling);

    if (this.values.size === 1) {
      const [soleSlot] = this.values.keys();
      soleSlot?.findDescendantById(`${soleSlot.id}-del`)?.destroyRecursively();
    }
    this.renderer.requestRender();
  }

  private createSlot(value: T, deletable: boolean): BoxRenderable {
    const slot = new BoxRenderable(this.renderer, {
      id: `slot-${this.slotSequence++}`,
      width: "100%",
      height: "100%",
      flexGrow: 1,
    });
    this.values.set(slot, value);
    this.fillLeaf(slot, value, deletable);
    return slot;
  }

  private spanFor(slot: BoxRenderable, direction: SplitDirection, hint: number): number {
    const horizontal = direction === "horizontal";
    const laidOut = horizontal ? slot.width : slot.height;
    const fallback = horizontal ? this.renderer.width : this.renderer.height;
    return Math.max(this.minPane * 2 + 1, laidOut || hint || fallback);
  }

  private applyGutters(): void {
    const visible = this.chromeVisible && this.guttersVisible;
    for (const split of this.splits) split.setGutterVisible(visible);
    this.renderer.requestRender();
  }
}

export function bindPaneControls(
  renderer: CliRenderer,
  movementOptions?: PaneMovementOptions,
): () => void {
  const controls = [createPaneNavigator(renderer), createPaneMovement(renderer, movementOptions)];
  return () => controls.forEach((control) => control.dispose());
}

export function bindKeys(renderer: CliRenderer, handler: (key: KeyEvent) => void): () => void {
  renderer.keyInput.on("keypress", handler);
  return () => renderer.keyInput.off("keypress", handler);
}

export function isModifiedKey(key: KeyEvent): boolean {
  return key.ctrl || key.meta || key.option;
}

export function bindDemoKeys(renderer: CliRenderer): () => void {
  return bindKeys(renderer, (key) => {
    if (key.name === "`" || key.name === '"') renderer.console.toggle();
    else if (key.name === ".") renderer.toggleDebugOverlay();
  });
}
