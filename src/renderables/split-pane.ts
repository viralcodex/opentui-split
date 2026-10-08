import {
  type BaseRenderable,
  BoxRenderable,
  type BoxOptions,
  type MouseEvent,
  type RenderContext,
} from "@opentui/core";
import { DefaultMinSize, DefaultPaneSize } from "../constants.js";
import type {
  GutterOptions,
  SplitDirection,
  SplitPaneGutterOptions,
  SplitPaneOptions,
} from "../models.js";
import { GutterRenderable } from "./gutter.js";

function validateSizes(name: string, values: number[] | null | undefined): number[] {
  if (values == null) return [];
  if (!Array.isArray(values) || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new TypeError(`${name} must contain only finite, non-negative numbers`);
  }
  return [...values];
}

function validateGutterSize(value: number | null | undefined): number {
  const size = value ?? 1;
  if (!Number.isInteger(size) || size < 1) {
    throw new TypeError("gutterSize must be a positive integer");
  }
  return size;
}

function validateDirection(value: SplitDirection | null | undefined): SplitDirection {
  const direction = value ?? "horizontal";
  if (direction !== "horizontal" && direction !== "vertical") {
    throw new TypeError('direction must be "horizontal" or "vertical"');
  }
  return direction;
}

function scaleSizes(sizes: number[], total: number): number[] {
  const previousTotal = sizes.reduce((sum, size) => sum + size, 0);
  if (sizes.length === 0 || previousTotal <= 0) return sizes.map(() => 0);

  const exact = sizes.map((size) => (size * total) / previousTotal);
  const scaled = exact.map(Math.floor);
  const remainder = total - scaled.reduce((sum, size) => sum + size, 0);
  const order = exact
    .map((size, index) => ({ index, fraction: size - scaled[index]! }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < remainder; index++) scaled[order[index]!.index]!++;
  return scaled;
}

export class SplitPaneRenderable extends BoxRenderable {
  private _direction: SplitDirection;
  private _gutterSize: number;
  private sizesState: number[];
  private minSizesState: number[];
  private resizeCallback: ((sizes: number[]) => void) | undefined;
  private gutterVisible: boolean;
  private gutterColor: GutterOptions["color"];
  private gutterGlyphs: GutterOptions["glyphs"];
  private userMouseDrag: BoxOptions["onMouseDrag"];
  private userMouseUp: BoxOptions["onMouseUp"];
  private userMouseDragEnd: BoxOptions["onMouseDragEnd"];

  private panes: BoxRenderable[] = [];
  private gutters: GutterRenderable[] = [];
  private auxiliaryChildren = new Map<BaseRenderable, number>();
  private pendingSizes: number[];
  private pendingMins: number[];
  private activeGutter = -1; // gutter index currently being dragged
  private dragStart = 0;
  private dragCurrent = 0;
  private dragLeftBasis = 0;
  private dragRightBasis = 0;
  private isDestroying = false;
  private lastLayoutSize: number;

  constructor(ctx: RenderContext, options: SplitPaneOptions) {
    const {
      direction: directionOption,
      sizes,
      minSizes,
      gutterSize,
      onSizesChange,
      gutterOptions,
      onMouseDrag,
      onMouseUp,
      onMouseDragEnd,
      ...boxOptions
    } = options;
    const direction = validateDirection(directionOption);
    super(ctx, {
      ...boxOptions,
      flexDirection: direction === "horizontal" ? "row" : "column",
    });
    this._direction = direction;
    this._gutterSize = validateGutterSize(gutterSize);
    this.resizeCallback = onSizesChange;
    this.gutterVisible = gutterOptions?.visible ?? true;
    this.gutterColor = gutterOptions?.color;
    this.gutterGlyphs = gutterOptions?.glyphs;
    this.pendingSizes = validateSizes("sizes", sizes);
    this.pendingMins = validateSizes("minSizes", minSizes);
    this.sizesState = [];
    this.minSizesState = [];
    this.userMouseDrag = onMouseDrag;
    this.userMouseUp = onMouseUp;
    this.userMouseDragEnd = onMouseDragEnd;
    this.setupDragHandling();
    this.lastLayoutSize = this.isHorizontal ? this.width : this.height;
  }

  get direction(): SplitDirection {
    return this._direction;
  }

  set direction(value: SplitDirection | null | undefined) {
    const direction = validateDirection(value);
    if (direction === this._direction) return;
    this._direction = direction;
    this.lastLayoutSize = this.isHorizontal ? this.width : this.height;
    this.flexDirection = direction === "horizontal" ? "row" : "column";
    this.rebuildChildren();
  }

  get sizes(): number[] {
    return [...(this.panes.length > 0 ? this.sizesState : this.pendingSizes)];
  }

  set sizes(values: number[] | null | undefined) {
    const sizes = validateSizes("sizes", values);
    this.pendingSizes = sizes;
    this.sizesState = this.panes.map(
      (_, index) => sizes[index] ?? this.sizesState[index] ?? DefaultPaneSize,
    );
    this.applySizing();
    this.requestRender();
  }

  get minSizes(): number[] {
    return [...(this.panes.length > 0 ? this.minSizesState : this.pendingMins)];
  }

  set minSizes(values: number[] | null | undefined) {
    const minSizes = validateSizes("minSizes", values);
    this.pendingMins = minSizes;
    this.minSizesState = this.panes.map(
      (_, index) => minSizes[index] ?? this.minSizesState[index] ?? DefaultMinSize,
    );
  }

  get gutterSize(): number {
    return this._gutterSize;
  }

  set gutterSize(value: number | null | undefined) {
    const size = validateGutterSize(value);
    if (size === this._gutterSize) return;
    this._gutterSize = size;
    this.rebuildChildren();
  }

  set gutterOptions(options: SplitPaneGutterOptions | null | undefined) {
    const visible = options?.visible ?? true;
    const color = options?.color;
    const glyphs = options?.glyphs;
    if (
      visible === this.gutterVisible &&
      color === this.gutterColor &&
      glyphs?.horizontal === this.gutterGlyphs?.horizontal &&
      glyphs?.vertical === this.gutterGlyphs?.vertical
    ) {
      return;
    }
    this.gutterVisible = visible;
    this.gutterColor = color;
    this.gutterGlyphs = glyphs;
    this.rebuildChildren();
  }

  get onSizesChange(): ((sizes: number[]) => void) | undefined {
    return this.resizeCallback;
  }

  set onSizesChange(callback: ((sizes: number[]) => void) | null | undefined) {
    this.resizeCallback = callback ?? undefined;
  }

  override set onMouseDrag(handler: BoxOptions["onMouseDrag"] | undefined) {
    this.userMouseDrag = handler ?? undefined;
  }

  override set onMouseUp(handler: BoxOptions["onMouseUp"] | undefined) {
    this.userMouseUp = handler ?? undefined;
  }

  override set onMouseDragEnd(handler: BoxOptions["onMouseDragEnd"] | undefined) {
    this.userMouseDragEnd = handler ?? undefined;
  }

  /** True when panes are laid out left-to-right (gutters are vertical hairlines). */
  private get isHorizontal(): boolean {
    return this._direction === "horizontal";
  }

  /** Read the coordinate (x or y) that moves the active gutter. */
  private axisCoord(event: MouseEvent): number {
    return this.isHorizontal ? event.x : event.y;
  }

  /** Read a pane's extent along the split axis. */
  private readExtent(pane: BoxRenderable): number {
    return this.isHorizontal ? pane.width : pane.height;
  }

  /** Write a pane's extent along the split axis without touching the cross axis. */
  private writeExtent(pane: BoxRenderable, size: number): void {
    if (this.isHorizontal) {
      pane.width = size;
    } else {
      pane.height = size;
    }
  }

  protected onResize(width: number, height: number): void {
    super.onResize(width, height);
    this.handleLayoutResize(width, height);
  }

  protected createGutter(options: GutterOptions): GutterRenderable {
    return new GutterRenderable(this._ctx, options);
  }

  protected isAuxiliaryChild(_obj: unknown): _obj is BaseRenderable {
    return false;
  }

  // The container handles the drag, not the gutter: a 1-cell gutter loses the
  // cursor immediately, so the renderer ends up capturing a neighbouring pane.
  // That pane bubbles its drag/up events up to this container, which stays in
  // the chain for the whole gesture.
  private setupDragHandling(): void {
    super.onMouseDrag = (event: MouseEvent) => {
      if (this.activeGutter >= 0) {
        event.stopPropagation();
        this.dragCurrent = this.axisCoord(event);
        this.applyDrag(this.activeGutter, this.dragCurrent - this.dragStart);
      }
      this.userMouseDrag?.call(this, event);
    };

    const end = (event: MouseEvent) => {
      if (this.activeGutter >= 0) {
        event.stopPropagation();
        // Reset the dragged gutter (its own onMouseUp may not fire once the pointer
        // has left the 1-cell strip) and restore its pointer for the hover state.
        this.gutters[this.activeGutter]?.release();
        this.activeGutter = -1;
      }
    };
    super.onMouseUp = (event) => {
      end(event);
      this.userMouseUp?.call(this, event);
    };
    super.onMouseDragEnd = (event) => {
      end(event);
      this.userMouseDragEnd?.call(this, event);
    };
  }

  private grabGutter(gutterIndex: number, event: MouseEvent): void {
    this.activeGutter = gutterIndex;
    this.dragStart = this.axisCoord(event);
    this.dragCurrent = this.dragStart;
    this.captureBasis(gutterIndex);
  }

  // Capture the fixed pane's basis and the neighbour's *actual* rendered size
  // (works whether the neighbour is fixed or the flexible last pane).
  private captureBasis(gutterIndex: number): void {
    this.sizesState = this.panes.map((_, index) => this.paneSize(index));
    this.dragLeftBasis = this.paneSize(gutterIndex);
    this.dragRightBasis = this.paneSize(gutterIndex + 1);
  }

  private paneSize(index: number): number {
    const pane = this.panes[index];
    return pane ? this.readExtent(pane) : 0;
  }

  // Every pane but the last is fixed-size and draggable; the last pane flexes to
  // fill whatever space remains, so the split always fills its container.
  private applySizing(): void {
    const lastIndex = this.panes.length - 1;

    this.panes.forEach((pane, index) => {
      const isLast = index === lastIndex;

      pane.flexGrow = Number(isLast);
      pane.flexShrink = Number(isLast);
      pane.overflow = "hidden";

      if (this.isHorizontal) {
        pane.width = isLast ? "auto" : (this.sizesState[index] ?? 0);
        pane.height = "auto";
      } else {
        pane.width = "auto";
        pane.height = isLast ? "auto" : (this.sizesState[index] ?? 0);
      }
    });
  }

  private applyBasis(index: number): void {
    const pane = this.panes[index];
    if (!pane) return;
    this.writeExtent(pane, this.sizesState[index] ?? 0);
  }

  // Scale all panes to the space left after gutters. Minimums constrain direct
  // dragging, but cannot be hard layout constraints when the container itself
  // becomes smaller than their sum.
  private handleLayoutResize(width: number, height: number): void {
    const next = this.isHorizontal ? width : height;
    const prev = this.lastLayoutSize;
    this.lastLayoutSize = next;
    if (prev <= 0 || next === prev) return;

    const lastIndex = this.panes.length - 1;
    if (lastIndex < 0) return;

    const gutterSpace = this.gutters.length * this._gutterSize;
    const previousAvailable = Math.max(0, prev - gutterSpace);
    const nextAvailable = Math.max(0, next - gutterSpace);
    const fixedTotal = this.panes
      .slice(0, lastIndex)
      .reduce((total, _, index) => total + this.paneSize(index), 0);
    const previousSizes = this.panes.map((_, index) =>
      index === lastIndex ? Math.max(0, previousAvailable - fixedTotal) : this.paneSize(index),
    );
    const previousTotal = previousSizes.reduce((total, size) => total + size, 0);
    if (previousTotal <= 0) return;

    this.sizesState = scaleSizes(previousSizes, nextAvailable);

    for (let index = 0; index < lastIndex; index++) this.applyBasis(index);

    if (this.activeGutter >= 0) {
      this.dragLeftBasis = this.sizesState[this.activeGutter] ?? 0;
      this.dragRightBasis = this.sizesState[this.activeGutter + 1] ?? 0;
      this.dragStart = this.dragCurrent;
    }

    if (lastIndex > 0) {
      queueMicrotask(() => {
        if (!this.isDestroyed) this.requestRender();
      });
      this.resizeCallback?.([...this.sizesState]);
    }
  }

  private applyDrag(gutterIndex: number, delta: number): void {
    const left = gutterIndex;
    const right = gutterIndex + 1;
    const lastIndex = this.panes.length - 1;
    const total = this.dragLeftBasis + this.dragRightBasis;
    const minL = Math.ceil(this.minSizesState[left] ?? 0);
    const minR = Math.ceil(this.minSizesState[right] ?? 0);

    if (total < minL + minR) return;

    let newLeft = this.dragLeftBasis + delta;
    newLeft = Math.max(minL, Math.min(total - minR, newLeft));
    if (newLeft === this.sizesState[left]) return;

    this.sizesState[left] = newLeft;
    this.applyBasis(left);
    this.sizesState[right] = total - newLeft;
    // If the right neighbour is a fixed pane, it gives up what left gained.
    // If it's the flexible last pane, flexGrow absorbs the change automatically.
    if (right !== lastIndex) {
      this.applyBasis(right);
    }
    this.requestRender();
    this.resizeCallback?.([...this.sizesState]);
  }

  override add(obj: unknown, index?: number): number {
    if (this.isAuxiliaryChild(obj)) {
      this.auxiliaryChildren.set(obj, this.paneIndexAt(index));
      return super.add(obj, index);
    }
    if (!(obj instanceof BoxRenderable)) return -1;

    return this.insertPane(obj, this.paneIndexAt(index));
  }

  override insertBefore(obj: unknown, anchor?: unknown): number {
    if (this.isAuxiliaryChild(obj)) {
      const anchorIndex = this.getChildren().findIndex((child) => child === anchor);
      this.auxiliaryChildren.set(obj, this.paneIndexAt(anchorIndex < 0 ? undefined : anchorIndex));
      return super.insertBefore(obj, anchor);
    }
    if (!(obj instanceof BoxRenderable)) return -1;
    if (!(anchor instanceof BoxRenderable)) return this.add(obj);

    const paneIndex = this.panes.indexOf(anchor);
    return paneIndex < 0 ? this.add(obj) : this.insertPane(obj, paneIndex);
  }

  private paneIndexAt(childIndex?: number): number {
    if (childIndex === undefined) return this.panes.length;
    return this.getChildren()
      .slice(0, childIndex)
      .filter((child) => this.panes.includes(child as BoxRenderable)).length;
  }

  override remove(child: BaseRenderable): void {
    if (this.isDestroying || this.isDestroyed) {
      super.remove(child);
      return;
    }
    if (this.auxiliaryChildren.has(child)) {
      this.auxiliaryChildren.delete(child);
      super.remove(child);
      return;
    }
    if (this.gutters.includes(child as GutterRenderable)) {
      throw new Error("SplitPaneRenderable: Cannot remove a generated gutter directly");
    }

    const paneIndex = this.panes.indexOf(child as BoxRenderable);
    if (paneIndex < 0) {
      super.remove(child);
      return;
    }

    this.panes.splice(paneIndex, 1);
    this.sizesState.splice(paneIndex, 1);
    this.minSizesState.splice(paneIndex, 1);
    this.shiftAuxiliaryChildren(paneIndex, -1);
    super.remove(child);
    this.rebuildChildren();
  }

  addPane(pane: BoxRenderable, size?: number, minSize?: number): void {
    this.insertPane(pane, this.panes.length, size, minSize);
  }

  private insertPane(pane: BoxRenderable, index: number, size?: number, minSize?: number): number {
    const validatedSize = size === undefined ? undefined : validateSizes("size", [size])[0];
    const validatedMin = minSize === undefined ? undefined : validateSizes("minSize", [minSize])[0];
    const currentIndex = this.panes.indexOf(pane);

    if (currentIndex >= 0) {
      const [currentSize] = this.sizesState.splice(currentIndex, 1);
      const [currentMin] = this.minSizesState.splice(currentIndex, 1);
      this.panes.splice(currentIndex, 1);
      this.shiftAuxiliaryChildren(currentIndex, -1);
      if (currentIndex < index) index--;
      size = validatedSize ?? currentSize;
      minSize = validatedMin ?? currentMin;
    } else {
      size = validatedSize;
      minSize = validatedMin;
    }

    index = Math.max(0, Math.min(index, this.panes.length));

    this.shiftAuxiliaryChildren(index, 1);
    this.panes.splice(index, 0, pane);
    this.sizesState.splice(index, 0, size ?? this.pendingSizes[index] ?? DefaultPaneSize);
    this.minSizesState.splice(index, 0, minSize ?? this.pendingMins[index] ?? DefaultMinSize);
    this.rebuildChildren();

    return this.getChildren().indexOf(pane);
  }

  private shiftAuxiliaryChildren(paneIndex: number, delta: -1 | 1): void {
    for (const [child, index] of this.auxiliaryChildren) {
      if (index > paneIndex) this.auxiliaryChildren.set(child, index + delta);
    }
  }

  private rebuildChildren(): void {
    this.gutters[this.activeGutter]?.release();
    this.activeGutter = -1;

    for (const gutter of this.gutters) {
      if (gutter.parent === this) super.remove(gutter);
      gutter.destroy();
    }
    this.gutters = [];

    for (const pane of this.panes) {
      if (pane.parent === this) super.remove(pane);
    }

    this.panes.forEach((pane, index) => {
      for (const [child, paneIndex] of this.auxiliaryChildren) {
        if (paneIndex === index && child.parent === this) super.add(child);
      }
      if (index > 0) {
        const gutterIndex = index - 1;
        const gutter = this.createGutter({
          id: `${this.id}-gutter-${gutterIndex}`,
          direction: this._direction,
          width: this.isHorizontal ? this._gutterSize : "auto",
          height: this.isHorizontal ? "auto" : this._gutterSize,
          onGrab: (event) => this.grabGutter(gutterIndex, event),
          visible: this.gutterVisible,
          ...(this.gutterGlyphs !== undefined ? { glyphs: this.gutterGlyphs } : {}),
          ...(this.gutterColor !== undefined ? { color: this.gutterColor } : {}),
        });
        this.gutters.push(gutter);
        super.add(gutter);
      }
      super.add(pane);
    });
    for (const [child, paneIndex] of this.auxiliaryChildren) {
      if (paneIndex >= this.panes.length && child.parent === this) super.add(child);
    }
    this.applySizing();
  }

  setGutterVisible(visible: boolean): void {
    this.gutterVisible = visible;
    for (const gutter of this.gutters) gutter.showHairline = visible;
  }

  override destroyRecursively(): void {
    this.isDestroying = true;
    super.destroyRecursively();
  }
}
