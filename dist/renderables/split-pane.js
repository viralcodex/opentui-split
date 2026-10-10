import { BoxRenderable, } from "@opentui/core";
import { DefaultMinSize, DefaultPaneSize } from "../constants.js";
import { GutterRenderable } from "./gutter.js";
function validateSizes(name, values) {
    if (values == null)
        return [];
    if (!Array.isArray(values) || values.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new TypeError(`${name} must contain only finite, non-negative numbers`);
    }
    return [...values];
}
function validateGutterSize(value) {
    const size = value ?? 1;
    if (!Number.isInteger(size) || size < 1) {
        throw new TypeError("gutterSize must be a positive integer");
    }
    return size;
}
function validateDirection(value) {
    const direction = value ?? "horizontal";
    if (direction !== "horizontal" && direction !== "vertical") {
        throw new TypeError('direction must be "horizontal" or "vertical"');
    }
    return direction;
}
function validateOptionalSize(name, value) {
    return value === undefined ? undefined : validateSizes(name, [value])[0];
}
function resolveSize(requested, current, pending, fallback) {
    return requested ?? current ?? pending ?? fallback;
}
function scaleSizes(sizes, total) {
    const previousTotal = sizes.reduce((sum, size) => sum + size, 0);
    if (sizes.length === 0 || previousTotal <= 0)
        return sizes.map(() => 0);
    const exact = sizes.map((size) => (size * total) / previousTotal);
    const scaled = exact.map(Math.floor);
    const remainder = total - scaled.reduce((sum, size) => sum + size, 0);
    const order = exact
        .map((size, index) => ({ index, fraction: size - scaled[index] }))
        .sort((a, b) => b.fraction - a.fraction);
    for (let index = 0; index < remainder; index++)
        scaled[order[index].index]++;
    return scaled;
}
function containsNode(parent, child) {
    for (let node = child.parent; node; node = node.parent) {
        if (node === parent)
            return true;
    }
    return false;
}
export class SplitPaneRenderable extends BoxRenderable {
    _direction;
    _gutterSize;
    sizesState;
    minSizesState;
    resizeCallback;
    gutterVisible;
    gutterColor;
    gutterGlyphs;
    userMouseDrag;
    userMouseUp;
    userMouseDragEnd;
    panes = [];
    gutters = [];
    auxiliaryChildren = new Map();
    pendingSizes;
    pendingMins;
    activeGutter = -1;
    dragStart = 0;
    dragCurrent = 0;
    dragLeftBasis = 0;
    dragRightBasis = 0;
    isDestroying = false;
    lastLayoutSize;
    constructor(ctx, options) {
        const { direction: directionOption, sizes, minSizes, gutterSize, onSizesChange, gutterOptions, onMouseDrag, onMouseUp, onMouseDragEnd, ...boxOptions } = options;
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
    get direction() {
        return this._direction;
    }
    set direction(value) {
        const direction = validateDirection(value);
        if (direction === this._direction)
            return;
        this._direction = direction;
        this.lastLayoutSize = this.isHorizontal ? this.width : this.height;
        this.flexDirection = direction === "horizontal" ? "row" : "column";
        this.rebuildChildren();
    }
    get sizes() {
        return [...(this.panes.length > 0 ? this.sizesState : this.pendingSizes)];
    }
    set sizes(values) {
        const sizes = validateSizes("sizes", values);
        this.pendingSizes = sizes;
        this.sizesState = this.panes.map((_, index) => sizes[index] ?? this.sizesState[index] ?? DefaultPaneSize);
        this.applySizing();
        this.requestRender();
    }
    get minSizes() {
        return [...(this.panes.length > 0 ? this.minSizesState : this.pendingMins)];
    }
    set minSizes(values) {
        const minSizes = validateSizes("minSizes", values);
        this.pendingMins = minSizes;
        this.minSizesState = this.panes.map((_, index) => minSizes[index] ?? this.minSizesState[index] ?? DefaultMinSize);
    }
    get gutterSize() {
        return this._gutterSize;
    }
    set gutterSize(value) {
        const size = validateGutterSize(value);
        if (size === this._gutterSize)
            return;
        this._gutterSize = size;
        this.rebuildChildren();
    }
    set gutterOptions(options) {
        const visible = options?.visible ?? true;
        const color = options?.color;
        const glyphs = options?.glyphs;
        if (this.hasGutterOptions(visible, color, glyphs))
            return;
        this.gutterVisible = visible;
        this.gutterColor = color;
        this.gutterGlyphs = glyphs;
        this.rebuildChildren();
    }
    hasGutterOptions(visible, color, glyphs) {
        return (visible === this.gutterVisible &&
            color === this.gutterColor &&
            glyphs?.horizontal === this.gutterGlyphs?.horizontal &&
            glyphs?.vertical === this.gutterGlyphs?.vertical);
    }
    get onSizesChange() {
        return this.resizeCallback;
    }
    set onSizesChange(callback) {
        this.resizeCallback = callback ?? undefined;
    }
    set onMouseDrag(handler) {
        this.userMouseDrag = handler ?? undefined;
    }
    set onMouseUp(handler) {
        this.userMouseUp = handler ?? undefined;
    }
    set onMouseDragEnd(handler) {
        this.userMouseDragEnd = handler ?? undefined;
    }
    get isHorizontal() {
        return this._direction === "horizontal";
    }
    axisCoord(event) {
        return this.isHorizontal ? event.x : event.y;
    }
    readExtent(pane) {
        return this.isHorizontal ? pane.width : pane.height;
    }
    writeExtent(pane, size) {
        if (this.isHorizontal) {
            pane.width = size;
        }
        else {
            pane.height = size;
        }
    }
    onResize(width, height) {
        super.onResize(width, height);
        this.handleLayoutResize(width, height);
    }
    createGutter(options) {
        return new GutterRenderable(this._ctx, options);
    }
    isAuxiliaryChild(_obj) {
        return false;
    }
    // Drag events bubble through the split after the pointer leaves its 1-cell gutter.
    setupDragHandling() {
        super.onMouseDrag = (event) => {
            if (this.activeGutter >= 0) {
                event.stopPropagation();
                this.dragCurrent = this.axisCoord(event);
                this.applyDrag(this.activeGutter, this.dragCurrent - this.dragStart);
            }
            this.userMouseDrag?.call(this, event);
        };
        const end = (event) => {
            if (this.activeGutter >= 0) {
                event.stopPropagation();
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
    grabGutter(gutterIndex, event) {
        this.activeGutter = gutterIndex;
        this.dragStart = this.axisCoord(event);
        this.dragCurrent = this.dragStart;
        this.captureBasis(gutterIndex);
    }
    captureBasis(gutterIndex) {
        this.sizesState = this.panes.map((_, index) => this.paneSize(index));
        this.dragLeftBasis = this.paneSize(gutterIndex);
        this.dragRightBasis = this.paneSize(gutterIndex + 1);
    }
    paneSize(index) {
        const pane = this.panes[index];
        return pane ? this.readExtent(pane) : 0;
    }
    applySizing() {
        const lastIndex = this.panes.length - 1;
        this.panes.forEach((pane, index) => {
            const isLast = index === lastIndex;
            pane.flexGrow = Number(isLast);
            pane.flexShrink = Number(isLast);
            pane.overflow = "hidden";
            if (this.isHorizontal) {
                pane.width = isLast ? "auto" : (this.sizesState[index] ?? 0);
                pane.height = "auto";
            }
            else {
                pane.width = "auto";
                pane.height = isLast ? "auto" : (this.sizesState[index] ?? 0);
            }
        });
    }
    applyBasis(index) {
        const pane = this.panes[index];
        if (!pane)
            return;
        this.writeExtent(pane, this.sizesState[index] ?? 0);
    }
    // Minimums constrain dragging, but the split may shrink below their sum.
    handleLayoutResize(width, height) {
        const next = this.isHorizontal ? width : height;
        const prev = this.lastLayoutSize;
        this.lastLayoutSize = next;
        if (prev <= 0)
            return;
        if (next === prev)
            return;
        const lastIndex = this.panes.length - 1;
        if (lastIndex < 0)
            return;
        const gutterSpace = this.gutters.length * this._gutterSize;
        const previousAvailable = Math.max(0, prev - gutterSpace);
        const nextAvailable = Math.max(0, next - gutterSpace);
        const previousSizes = this.sizesBeforeResize(previousAvailable, lastIndex);
        const previousTotal = previousSizes.reduce((total, size) => total + size, 0);
        if (previousTotal <= 0)
            return;
        this.sizesState = scaleSizes(previousSizes, nextAvailable);
        for (let index = 0; index < lastIndex; index++)
            this.applyBasis(index);
        this.resetActiveDragBasis();
        if (lastIndex > 0) {
            queueMicrotask(() => {
                if (!this.isDestroyed)
                    this.requestRender();
            });
            this.resizeCallback?.([...this.sizesState]);
        }
    }
    sizesBeforeResize(available, lastIndex) {
        const fixedTotal = this.panes
            .slice(0, lastIndex)
            .reduce((total, _, index) => total + this.paneSize(index), 0);
        return this.panes.map((_, index) => index === lastIndex ? Math.max(0, available - fixedTotal) : this.paneSize(index));
    }
    resetActiveDragBasis() {
        if (this.activeGutter < 0)
            return;
        this.dragLeftBasis = this.sizesState[this.activeGutter] ?? 0;
        this.dragRightBasis = this.sizesState[this.activeGutter + 1] ?? 0;
        this.dragStart = this.dragCurrent;
    }
    applyDrag(gutterIndex, delta) {
        const left = gutterIndex;
        const right = gutterIndex + 1;
        const lastIndex = this.panes.length - 1;
        const total = this.dragLeftBasis + this.dragRightBasis;
        const minL = Math.ceil(this.minSizesState[left] ?? 0);
        const minR = Math.ceil(this.minSizesState[right] ?? 0);
        if (total < minL + minR)
            return;
        let newLeft = this.dragLeftBasis + delta;
        newLeft = Math.max(minL, Math.min(total - minR, newLeft));
        if (newLeft === this.sizesState[left])
            return;
        this.sizesState[left] = newLeft;
        this.applyBasis(left);
        this.sizesState[right] = total - newLeft;
        if (right !== lastIndex) {
            this.applyBasis(right);
        }
        this.requestRender();
        this.resizeCallback?.([...this.sizesState]);
    }
    add(obj, index) {
        if (this.isAuxiliaryChild(obj)) {
            this.auxiliaryChildren.set(obj, this.paneIndexAt(index));
            return super.add(obj, index);
        }
        if (!(obj instanceof BoxRenderable))
            return -1;
        return this.insertPane(obj, this.paneIndexAt(index));
    }
    insertBefore(obj, anchor) {
        if (this.isAuxiliaryChild(obj)) {
            const anchorIndex = this.getChildren().findIndex((child) => child === anchor);
            this.auxiliaryChildren.set(obj, this.paneIndexAt(anchorIndex < 0 ? undefined : anchorIndex));
            return super.insertBefore(obj, anchor);
        }
        if (!(obj instanceof BoxRenderable))
            return -1;
        if (!(anchor instanceof BoxRenderable))
            return this.add(obj);
        const paneIndex = this.panes.indexOf(anchor);
        return paneIndex < 0 ? this.add(obj) : this.insertPane(obj, paneIndex);
    }
    paneIndexAt(childIndex) {
        if (childIndex === undefined)
            return this.panes.length;
        return this.getChildren()
            .slice(0, childIndex)
            .filter((child) => this.panes.includes(child)).length;
    }
    remove(child) {
        if (this.isDestroying || this.isDestroyed) {
            super.remove(child);
            return;
        }
        if (this.auxiliaryChildren.has(child)) {
            this.auxiliaryChildren.delete(child);
            super.remove(child);
            return;
        }
        if (this.gutters.includes(child)) {
            throw new Error("SplitPaneRenderable: Cannot remove a generated gutter directly");
        }
        const paneIndex = this.panes.indexOf(child);
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
    addPane(pane, size, minSize) {
        this.insertPane(pane, this.panes.length, size, minSize);
    }
    // The panes in layout order (gutters and auxiliary children excluded).
    get paneList() {
        return [...this.panes];
    }
    // Move a pane and its sizing state to a new index.
    movePane(pane, toIndex) {
        const from = this.panes.indexOf(pane);
        if (from < 0)
            return false;
        if (!Number.isInteger(toIndex))
            throw new TypeError("toIndex must be a finite integer");
        const to = Math.max(0, Math.min(toIndex, this.panes.length - 1));
        if (to === from)
            return false;
        const last = this.panes.length - 1;
        const flexibleSize = this.paneSize(last);
        if (flexibleSize > 0)
            this.sizesState[last] = flexibleSize;
        const [movedPane] = this.panes.splice(from, 1);
        const [movedSize] = this.sizesState.splice(from, 1);
        const [movedMin] = this.minSizesState.splice(from, 1);
        this.panes.splice(to, 0, movedPane);
        this.sizesState.splice(to, 0, movedSize);
        this.minSizesState.splice(to, 0, movedMin);
        this.arrangeChildren();
        this.applySizing();
        this.requestRender();
        this.resizeCallback?.([...this.sizesState]);
        return true;
    }
    // Swap panes while keeping their slots in place.
    swapWith(self, other) {
        if (self === other)
            return false;
        if (containsNode(self, other) || containsNode(other, self))
            return false;
        const otherSplit = other.parent;
        if (!(otherSplit instanceof SplitPaneRenderable))
            return false;
        const selfIndex = this.panes.indexOf(self);
        const otherIndex = otherSplit.panes.indexOf(other);
        if (selfIndex < 0 || otherIndex < 0)
            return false;
        if (otherSplit === this) {
            this.panes[selfIndex] = other;
            this.panes[otherIndex] = self;
            this.arrangeChildren();
            this.applySizing();
            this.requestRender();
            return true;
        }
        super.remove(self);
        otherSplit.removePaneNode(other);
        this.panes[selfIndex] = other;
        otherSplit.panes[otherIndex] = self;
        this.arrangeChildren();
        otherSplit.arrangeChildren();
        this.applySizing();
        otherSplit.applySizing();
        this.requestRender();
        otherSplit.requestRender();
        return true;
    }
    removePaneNode(pane) {
        if (pane.parent === this)
            super.remove(pane);
    }
    insertPane(pane, index, size, minSize) {
        const requestedSize = validateOptionalSize("size", size);
        const requestedMin = validateOptionalSize("minSize", minSize);
        const current = this.detachPane(pane);
        if (current && current.index < index)
            index--;
        index = Math.max(0, Math.min(index, this.panes.length));
        this.shiftAuxiliaryChildren(index, 1);
        this.panes.splice(index, 0, pane);
        this.sizesState.splice(index, 0, resolveSize(requestedSize, current?.size, this.pendingSizes[index], DefaultPaneSize));
        this.minSizesState.splice(index, 0, resolveSize(requestedMin, current?.minSize, this.pendingMins[index], DefaultMinSize));
        this.rebuildChildren();
        return this.getChildren().indexOf(pane);
    }
    detachPane(pane) {
        const index = this.panes.indexOf(pane);
        if (index < 0)
            return null;
        const [size] = this.sizesState.splice(index, 1);
        const [minSize] = this.minSizesState.splice(index, 1);
        this.panes.splice(index, 1);
        this.shiftAuxiliaryChildren(index, -1);
        return { index, size, minSize };
    }
    shiftAuxiliaryChildren(paneIndex, delta) {
        for (const [child, index] of this.auxiliaryChildren) {
            if (index > paneIndex)
                this.auxiliaryChildren.set(child, index + delta);
        }
    }
    arrangeChildren() {
        const ordered = [];
        this.panes.forEach((pane, paneIndex) => {
            for (const [child, ownerIndex] of this.auxiliaryChildren) {
                if (ownerIndex === paneIndex)
                    ordered.push(child);
            }
            if (paneIndex > 0)
                ordered.push(this.gutters[paneIndex - 1]);
            ordered.push(pane);
        });
        for (const [child, ownerIndex] of this.auxiliaryChildren) {
            if (ownerIndex >= this.panes.length)
                ordered.push(child);
        }
        const current = this.getChildren();
        ordered.forEach((child, index) => {
            const previous = current.indexOf(child);
            if (previous === index)
                return;
            const anchor = current[index];
            if (anchor)
                super.insertBefore(child, anchor);
            else
                super.add(child);
            if (previous >= 0)
                current.splice(previous, 1);
            current.splice(index, 0, child);
        });
        while (current.length > ordered.length) {
            super.remove(current.pop());
        }
    }
    rebuildChildren() {
        this.gutters[this.activeGutter]?.release();
        this.activeGutter = -1;
        for (const gutter of this.gutters) {
            if (gutter.parent === this)
                super.remove(gutter);
            gutter.destroy();
        }
        this.gutters = [];
        for (let gutterIndex = 0; gutterIndex < this.panes.length - 1; gutterIndex++) {
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
        this.arrangeChildren();
        this.applySizing();
    }
    setGutterVisible(visible) {
        this.gutterVisible = visible;
        for (const gutter of this.gutters)
            gutter.showHairline = visible;
    }
    destroyRecursively() {
        this.isDestroying = true;
        super.destroyRecursively();
    }
}
//# sourceMappingURL=split-pane.js.map