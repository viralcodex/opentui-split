/**
 * Add-panes demo — grow the layout at runtime.
 *
 * Every pane has a small ＋ button in its bottom-right corner. Click it and a
 * little menu offers two orientations:
 *
 *   │  Vertical    → the pane splits left | right (a vertical gutter)
 *   ─  Horizontal  → the pane splits top / bottom (a horizontal gutter)
 *
 * Picking one turns that pane into a two-pane SplitPane: the original pane on
 * one side and a fresh "pane <x>" on the other. Both are draggable via the
 * gutter, and each new pane gets its own ＋ button, so you can keep subdividing.
 *
 * The gutters draw themselves; press `g` to hide/show them.
 *
 * How it stays simple: each position in the tree is a `slot` (a plain Box). A
 * slot holds EITHER a leaf (the bordered "pane <x>" box) or a nested SplitPane.
 * Splitting a leaf never touches its parent — we just create a fresh SplitPane
 * inside that one slot and hand it two new child slots. So the engine's
 * append-only `addPane` is all we ever need; nothing gets reparented.
 */

import {
  CliRenderer,
  createCliRenderer,
  RGBA,
  BoxRenderable,
  TextRenderable,
  type KeyEvent,
  type MouseEvent,
} from "@opentui/core";
import { SplitPaneRenderable } from "../src/index.ts";

/** Minimal standalone demo keybindings (console toggle, debug overlay). */
function setupCommonDemoKeys(renderer: CliRenderer): void {
  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.name === "`" || key.name === '"') renderer.console.toggle();
    else if (key.name === ".") renderer.toggleDebugOverlay();
  });
}

// --- Theme ------------------------------------------------------------------
const PaneBorder = RGBA.fromInts(90, 90, 110);
const TextFg = RGBA.fromInts(220, 220, 230);
const Accent = RGBA.fromInts(120, 200, 255);
const AccentFg = RGBA.fromInts(18, 18, 28);
const DeleteBg = RGBA.fromInts(210, 90, 90);
const DeleteFg = RGBA.fromInts(28, 12, 14);
const MenuBg = RGBA.fromInts(34, 38, 54);
const MenuHoverBg = RGBA.fromInts(50, 90, 140);
const Background = RGBA.fromInts(18, 18, 28);

/** A pleasant rotation of pane background tints so nested panes stay legible. */
const PANE_TINTS = [
  RGBA.fromInts(24, 40, 40),
  RGBA.fromInts(40, 30, 44),
  RGBA.fromInts(30, 34, 48),
  RGBA.fromInts(40, 38, 26),
  RGBA.fromInts(26, 36, 30),
  RGBA.fromInts(38, 28, 34),
];

// --- Layout constants -------------------------------------------------------
/** Smallest pane extent (cells) — also the drag/split floor. */
const MIN_PANE = 6;
const MENU_W = 20;
const MENU_H = 4;

// --- Stateless helpers ------------------------------------------------------

/** A slot is a plain layout box (id "slot-<n>"); gutters/splits have suffixes. */
const isSlot = (r: BoxRenderable): boolean => /^slot-\d+$/.test(r.id);

/** Give a clickable renderable a pointer cursor while hovered. */
function usesPointerCursor(renderer: CliRenderer, r: BoxRenderable): void {
  r.onMouseOver = () => renderer.setMousePointer("pointer");
  r.onMouseOut = () => renderer.setMousePointer("default");
}

/**
 * A small action button (＋ / ✕) pinned to a corner of a pane. It sits absolute
 * so it never nudges the centered label, and swallows its own mousedown so the
 * click never reaches the pane or gutter beneath it.
 */
function createIconButton(
  renderer: CliRenderer,
  opts: {
    id: string;
    icon: string;
    corner: "bottom-right" | "top-right";
    background: RGBA;
    foreground: RGBA;
    onPress: () => void;
  },
): BoxRenderable {
  const btn = new BoxRenderable(renderer, {
    id: opts.id,
    position: "absolute",
    right: 0,
    ...(opts.corner === "bottom-right" ? { bottom: 0 } : { top: 0 }),
    backgroundColor: opts.background,
    paddingLeft: 1,
    paddingRight: 1,
  });
  btn.add(
    new TextRenderable(renderer, {
      id: `${opts.id}-icon`,
      content: opts.icon,
      fg: opts.foreground,
    }),
  );
  btn.onMouseDown = (event: MouseEvent) => {
    event.stopPropagation();
    opts.onPress();
  };
  usesPointerCursor(renderer, btn);
  return btn;
}

/**
 * Owns the live layout tree inside the `stage` box: which slot holds which pane,
 * the id/number sequences, and the single open orientation menu. All runtime
 * mutation (split, delete, menu) goes through here.
 */
class PaneLayout {
  private paneCounter = 0;
  private slotSeq = 0;
  private menuSeq = 0;

  /** Leaf slots → their "pane <x>" number. Containers are absent from the map. */
  private readonly paneNumber = new Map<BoxRenderable, number>();

  /** Every live split, so `g` can toggle all their gutters at once. */
  private readonly splits = new Set<SplitPaneRenderable>();
  private guttersVisible = true;

  /** At most one orientation menu is open; opening/dismissing another clears it. */
  private openMenu: { backdrop: BoxRenderable; menu: BoxRenderable } | null = null;

  constructor(
    private readonly renderer: CliRenderer,
    private readonly stage: BoxRenderable,
  ) {}

  /** Seed the stage with a single pane. The sole pane isn't deletable. */
  seed(): void {
    this.stage.add(this.createSlot(++this.paneCounter, false));
  }

  /** Flip every split's gutter hairline on or off. Resizing works either way. */
  toggleGutters(): void {
    this.guttersVisible = !this.guttersVisible;
    for (const split of this.splits) split.setGutterVisible(this.guttersVisible);
    this.renderer.requestRender();
  }

  private createSlot(paneNo: number, deletable: boolean): BoxRenderable {
    const slot = new BoxRenderable(this.renderer, {
      id: `slot-${this.slotSeq++}`,
      width: "100%",
      height: "100%",
      flexGrow: 1,
    });
    this.fillLeaf(slot, paneNo, deletable);
    return slot;
  }

  /**
   * Fill an (empty) slot with a leaf pane: centered "pane <x>", a ＋ button to
   * split, and (unless it's the sole pane) a ✕ button to delete it.
   */
  private fillLeaf(slot: BoxRenderable, paneNo: number, deletable: boolean): void {
    this.paneNumber.set(slot, paneNo);
    const tint = PANE_TINTS[(paneNo - 1) % PANE_TINTS.length] ?? PANE_TINTS[0]!;

    const leaf = new BoxRenderable(this.renderer, {
      id: `${slot.id}-leaf`,
      width: "100%",
      height: "100%",
      flexGrow: 1,
      border: true,
      borderStyle: "rounded",
      borderColor: PaneBorder,
      backgroundColor: tint,
      justifyContent: "center",
      alignItems: "center",
    });
    leaf.add(
      new TextRenderable(this.renderer, {
        id: `${slot.id}-label`,
        content: `pane ${paneNo}`,
        fg: TextFg,
      }),
    );

    leaf.add(
      createIconButton(this.renderer, {
        id: `${slot.id}-add`,
        icon: "＋",
        corner: "bottom-right",
        background: Accent,
        foreground: AccentFg,
        onPress: () => this.showMenu(slot, `${slot.id}-add`),
      }),
    );

    // Only the sole pane lacks a ✕ — there's nothing to collapse into once it's
    // the last pane standing.
    if (deletable) {
      leaf.add(
        createIconButton(this.renderer, {
          id: `${slot.id}-del`,
          icon: "✕",
          corner: "top-right",
          background: DeleteBg,
          foreground: DeleteFg,
          onPress: () => this.deleteSlot(slot),
        }),
      );
    }

    slot.add(leaf);
  }

  /**
   * Turn a leaf slot into a two-pane SplitPane in `direction`, keeping the
   * original pane and adding a brand-new one beside it. The slot's relationship
   * to its own parent is untouched — we only fill it with a fresh split.
   */
  private splitSlot(slot: BoxRenderable, direction: "horizontal" | "vertical"): void {
    const keepNumber = this.paneNumber.get(slot);
    if (keepNumber === undefined) return; // already a container, ignore

    // Tear down the leaf currently in the slot; its number moves to slotA.
    [...slot.getChildren()].forEach((c) => (c as BoxRenderable).destroyRecursively());
    this.paneNumber.delete(slot);

    const span = direction === "horizontal" ? slot.width : slot.height;
    const half = Math.max(MIN_PANE, Math.floor(span / 2));

    const split = new SplitPaneRenderable(this.renderer, {
      id: `${slot.id}-split`,
      direction,
      width: "100%",
      height: "100%",
      flexGrow: 1,
    });
    split.setGutterVisible(this.guttersVisible);
    this.splits.add(split);

    const slotA = this.createSlot(keepNumber, true); // original pane, kept — now deletable
    const slotB = this.createSlot(++this.paneCounter, true); // new pane

    split.addPane(slotA, half, MIN_PANE); // fixed-size, draggable
    split.addPane(slotB, half, MIN_PANE); // flexes to fill the rest

    slot.add(split);
    this.renderer.requestRender();
  }

  /**
   * Delete a leaf pane by collapsing its split: the surviving sibling takes over
   * the slot the split was living in. The last remaining pane can't be deleted
   * (its leaf carries no ✕), so there's always something to collapse into.
   */
  private deleteSlot(leafSlot: BoxRenderable): void {
    // Earlier collapses can leave the leaf nested inside wrapper slots
    // (slot > slot > leaf). Climb to the slot that sits directly inside a
    // split — removing THAT is what collapses the split.
    let slot = leafSlot;
    while (slot.parent && isSlot(slot.parent as BoxRenderable)) {
      slot = slot.parent as BoxRenderable;
    }
    const split = slot.parent;
    if (!(split instanceof SplitPaneRenderable)) return; // sole pane — nothing to collapse
    const parentSlot = split.parent as BoxRenderable | null;
    if (!parentSlot) return;
    const sibling = (split.getChildren() as BoxRenderable[]).find((c) => c !== slot && isSlot(c));
    if (!sibling) return;

    // Detach the sibling so tearing down the split doesn't take it with it, then
    // hand it (leaf or its own nested split — untouched) up to the parent slot.
    split.remove(sibling);
    parentSlot.remove(split);
    this.splits.delete(split);
    split.destroyRecursively(); // drops the deleted pane, its gutter, and this split's resize hook
    this.paneNumber.delete(leafSlot);

    // The engine stamped a fixed size on the sibling when it was a pane (fixed
    // panes get an explicit width/height + flexGrow 0). Restore it to a plain
    // fill-the-slot box so it expands into the space the deleted pane vacated.
    sibling.width = "100%";
    sibling.height = "100%";
    sibling.flexGrow = 1;
    sibling.flexShrink = 1;
    parentSlot.add(sibling);

    // If only one pane is left in the whole layout, it's the sole pane now:
    // strip its ✕ so the last pane can't be deleted.
    if (this.paneNumber.size === 1) {
      const [soleSlot] = this.paneNumber.keys();
      soleSlot?.findDescendantById(`${soleSlot.id}-del`)?.destroyRecursively();
    }
    this.renderer.requestRender();
  }

  /** Pop the orientation menu next to the button (id `anchorId`) that was clicked. */
  private showMenu(slot: BoxRenderable, anchorId: string): void {
    this.closeMenu();

    const anchor = slot.findDescendantById(anchorId) as BoxRenderable | undefined;
    if (!anchor) return;

    // Full-screen catcher: any click outside the menu dismisses it.
    const backdrop = new BoxRenderable(this.renderer, {
      id: `menu-backdrop-${this.menuSeq}`,
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      zIndex: 1000,
    });
    backdrop.onMouseDown = (event: MouseEvent) => {
      event.stopPropagation();
      this.closeMenu();
    };

    // Anchor the menu above the button, its right edge near the button, clamped
    // to stay on screen.
    let left = clamp(anchor.x - MENU_W + 3, 0, this.renderer.width - MENU_W);
    let top = anchor.y - MENU_H;
    if (top < 0) top = anchor.y + 1;
    top = clamp(top, 0, this.renderer.height - MENU_H);

    const menu = new BoxRenderable(this.renderer, {
      id: `menu-${this.menuSeq++}`,
      position: "absolute",
      left,
      top,
      width: MENU_W,
      zIndex: 1001,
      border: true,
      borderStyle: "rounded",
      borderColor: Accent,
      backgroundColor: MenuBg,
      flexDirection: "column",
    });

    // Vertical gutter (│) → left|right → SplitPane direction "horizontal".
    menu.add(this.createMenuOption(`${menu.id}-vertical`, "│  Vertical", slot, "horizontal"));
    // Horizontal gutter (─) → top/bottom → SplitPane direction "vertical".
    menu.add(this.createMenuOption(`${menu.id}-horizontal`, "─  Horizontal", slot, "vertical"));

    this.renderer.root.add(backdrop);
    this.renderer.root.add(menu);
    this.openMenu = { backdrop, menu };
    this.renderer.requestRender();
  }

  private createMenuOption(
    id: string,
    label: string,
    slot: BoxRenderable,
    direction: "horizontal" | "vertical",
  ): BoxRenderable {
    const row = new BoxRenderable(this.renderer, {
      id,
      width: "100%",
      height: 1,
      paddingLeft: 1,
      backgroundColor: "transparent",
    });
    row.add(new TextRenderable(this.renderer, { id: `${id}-label`, content: label, fg: TextFg }));
    row.onMouseDown = (event: MouseEvent) => {
      event.stopPropagation();
      this.closeMenu();
      this.splitSlot(slot, direction);
    };
    row.onMouseOver = () => {
      row.backgroundColor = MenuHoverBg;
      this.renderer.setMousePointer("pointer");
    };
    row.onMouseOut = () => {
      row.backgroundColor = "transparent";
      this.renderer.setMousePointer("default");
    };
    return row;
  }

  private closeMenu(): void {
    if (!this.openMenu) return;
    this.openMenu.backdrop.destroyRecursively();
    this.openMenu.menu.destroyRecursively();
    this.openMenu = null;
    this.renderer.requestRender();
  }
}

/** Clamp `value` to the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function run(renderer: CliRenderer): void {
  renderer.start();
  renderer.setBackgroundColor(Background);

  const root = new BoxRenderable(renderer, {
    id: "add-panes-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 1,
    flexGrow: 1,
  });
  renderer.root.add(root);

  // The layout tree lives inside this container. The very first slot fills it.
  const stage = new BoxRenderable(renderer, {
    id: "add-panes-stage",
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    marginTop: 1,
  });
  root.add(stage);

  const layout = new PaneLayout(renderer, stage);
  layout.seed();

  // `g` hides/shows every gutter hairline at runtime; pane borders keep the
  // divider legible while hidden, and dragging still resizes.
  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.name === "g") layout.toggleGutters();
  });
}

export function destroy(renderer: CliRenderer): void {
  renderer.clearFrameCallbacks();
  renderer.root.getRenderable("add-panes-root")?.destroyRecursively();
}

if (import.meta.main) {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  run(renderer);
  setupCommonDemoKeys(renderer);
}
