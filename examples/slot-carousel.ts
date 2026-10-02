#!/usr/bin/env bun

/** Slot-style logo carousel inside draggable split panes. Press Space to spin. */

import {
  CliRenderer,
  createCliRenderer,
  RGBA,
  BoxRenderable,
  ImageRenderable,
  NativeImage,
  type BoxOptions,
  type RenderContext,
  type KeyEvent,
} from "@opentui/core";
import { SplitPaneRenderable } from "../src/index.ts";

// --- Theme (matches the add-panes demo) ------------------------------------
const BACKGROUND = RGBA.fromInts(12, 12, 20);
const CARD_BORDER = RGBA.fromInts(90, 90, 110);
/** Blank card fill — matches the logo's white ground so the reel reads clean. */
const BLANK = RGBA.fromInts(255, 255, 255);

// --- Carousel geometry ------------------------------------------------------
/** Card height (rows) and the gap between stacked cards. */
const CARD_H = 30;
const CARD_GAP = 1;
const CARD_UNIT = CARD_H + CARD_GAP;
/**
 * Cards per cycle and which one carries the logo slice. These are SHARED by
 * every column (not per-column): identical cycles + identical column height mean
 * the offset that centres the logo card is the same everywhere, so a synchronised
 * landing lines the slices up on the same rows.
 */
const CARD_COUNT = 5;
const LOGO_INDEX = 2;
/** Copies of the cycle stacked in the strip — enough travel room for the spin. */
const COPIES = 3;

// --- Jackpot timing ---------------------------------------------------------
/** Base ease-out duration (s) for the fast→slow spin. */
const SPIN_BASE = 2.2;
/** Extra seconds each column-to-the-right takes, so reels stop left→right. */
const SPIN_STAGGER = 0.55;
/** How long the assembled logo holds before the columns drift again. */
const HOLD_AFTER = 1.8;
/** Seconds the reels drift in their 1/-1/1 directions before the opening spin. */
const STARTUP_DRIFT = 1.6;

/** Ease-out cubic: quick off the line, gentle into the stop. */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

type Mode = "drift" | "spin" | "hold";

export interface CarouselColumnOptions extends BoxOptions {
  /** Idle drift speed in rows/second. */
  speed: number;
  /** +1 scrolls the cards up, -1 scrolls them down. */
  direction: 1 | -1;
}

/**
 * One vertical carousel column: a clipping viewport over a looping strip of
 * cards, one of which (LOGO_INDEX) is a full-bleed slice of the logo. Built once
 * its on-screen size is known and its slice has been cut, via {@link build}.
 */
export class CarouselColumn extends BoxRenderable {
  private readonly speed: number;
  private readonly direction: 1 | -1;

  private strip: BoxRenderable | null = null;
  private built = false;
  private perCopy = 0;
  private loopSpan = 0;
  /** Scroll position in rows. Kept in [0, loopSpan) while drifting. */
  private offset = 0;

  private mode: Mode = "drift";
  private spinFrom = 0;
  private spinTo = 0;
  private spinDur = 0;
  private spinElapsed = 0;
  private holdRemaining = 0;

  constructor(ctx: RenderContext, options: CarouselColumnOptions) {
    super(ctx, {
      overflow: "hidden",
      backgroundColor: BACKGROUND,
      ...options,
    });
    this.speed = options.speed;
    this.direction = options.direction;
  }

  get isBuilt(): boolean {
    return this.built;
  }

  /**
   * Build the looping strip. The logo card of every copy gets the aligned
   * `slice`; every other card is a plain white blank, so the reel reads clean
   * and only the payline lands the readable wordmark.
   * `logoRows` is the shared on-screen height (rows) for the aligned slice, the
   * same in every column so the assembled wordmark stays level and undistorted.
   * Call once the column has laid out (height known) and its slice is cut.
   */
  build(slice: NativeImage | null, logoRows: number): void {
    if (this.built || this.height <= 0) return;

    // Enough whole cycles to cover the column, so one copy already fills it.
    const need = Math.ceil(this.height / CARD_UNIT) + 1;
    this.perCopy = Math.ceil(need / CARD_COUNT) * CARD_COUNT;
    this.loopSpan = this.perCopy * CARD_UNIT;

    const strip = new BoxRenderable(this._ctx, {
      id: `${this.id}-strip`,
      position: "relative",
      width: "100%",
      flexDirection: "column",
    });

    for (let k = 0; k < this.perCopy * COPIES; k++) {
      const p = k % this.perCopy;
      const i = p % CARD_COUNT;
      if (i === LOGO_INDEX && slice) {
        // Logo card: no frame; the slice is centred at a shared height so the
        // three columns' slices line up into one wordmark when they land.
        const card = new BoxRenderable(this._ctx, {
          id: `${this.id}-card-${k}`,
          width: "100%",
          height: CARD_H,
          marginBottom: CARD_GAP,
          backgroundColor: BACKGROUND,
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
        });
        card.add(
          new ImageRenderable(this._ctx, {
            id: `${this.id}-card-${k}-img`,
            // Clone per card so each renderable owns its handle.
            source: slice.clone(),
            fit: "fill",
            width: "100%",
            height: logoRows,
          }),
        );
        strip.add(card);
      } else {
        // Decoy: a plain white blank, framed like the other "pane" boxes. The
        // white ground matches the logo card so the reel reads as one clean run.
        const card = new BoxRenderable(this._ctx, {
          id: `${this.id}-card-${k}`,
          width: "100%",
          height: CARD_H,
          marginBottom: CARD_GAP,
          border: true,
          borderStyle: "rounded",
          borderColor: CARD_BORDER,
          backgroundColor: BLANK,
        });
        strip.add(card);
      }
    }

    this.add(strip);
    this.strip = strip;
    this.built = true;
  }

  /** Offset that centres card index `j` on the column's vertical midline. */
  private centerOffset(j: number): number {
    return j * CARD_UNIT + CARD_H / 2 - this.height / 2;
  }

  /** Advance the animation by `dt` seconds. Driven from the frame callback. */
  update(dt: number): void {
    if (!this.built || this.loopSpan <= 0) return;

    if (this.mode === "spin") {
      this.spinElapsed += dt;
      const t = Math.min(1, this.spinElapsed / this.spinDur);
      this.offset = this.spinFrom + (this.spinTo - this.spinFrom) * easeOutCubic(t);
      if (t >= 1) {
        this.offset = this.spinTo;
        this.mode = "hold";
      }
    } else if (this.mode === "hold") {
      this.holdRemaining -= dt;
      if (this.holdRemaining <= 0) {
        // Snap the copy-1 logo card back to its copy-0 twin — same on-screen
        // position, but back in the wrap range so drift can loop forever.
        this.offset = ((this.offset % this.loopSpan) + this.loopSpan) % this.loopSpan;
        this.mode = "drift";
      }
    } else {
      const velocity = this.speed * this.direction;
      this.offset =
        (((this.offset + velocity * dt) % this.loopSpan) + this.loopSpan) % this.loopSpan;
    }

    this.strip!.translateY = -Math.round(this.offset);
  }

  /**
   * Kick off a jackpot spin that lands the logo card on the payline. `order` is
   * this column's position left→right and `count` the total, so columns stop in
   * sequence and all release together after the last one lands.
   */
  jackpot(order: number, count: number): void {
    if (!this.built || this.mode !== "drift") return;
    // Every column must LAND on the same on-screen row (the payline), which is
    // `aligned` (mod loopSpan). But each spins along its OWN direction to get
    // there: +1 columns ease UP into the copy above, -1 columns lift a copy and
    // ease DOWN into the copy below. Same final position, opposite travel — so
    // 1/-1/1 columns visibly converge on the assembled logo.
    const aligned =
      ((this.centerOffset(LOGO_INDEX) % this.loopSpan) + this.loopSpan) % this.loopSpan;
    if (this.direction === 1) {
      this.spinFrom = this.offset;
      this.spinTo = aligned + this.loopSpan; // travel up ~one loop
    } else {
      this.spinFrom = this.offset + this.loopSpan; // lift (same screen pos)
      this.spinTo = aligned; // travel down ~one loop
    }
    this.spinDur = SPIN_BASE + order * SPIN_STAGGER;
    this.spinElapsed = 0;
    const groupDur = SPIN_BASE + (count - 1) * SPIN_STAGGER;
    this.holdRemaining = groupDur - this.spinDur + HOLD_AFTER;
    this.mode = "spin";
  }
}

// --- Demo wiring ------------------------------------------------------------
const LOGO_PATH = new URL("../opentui.png", import.meta.url).pathname;

/** Columns drift at different speeds/directions; they START equal width. */
const COLUMNS: Array<{ speed: number; direction: 1 | -1 }> = [
  { speed: 5, direction: 1 },
  { speed: 7, direction: -1 },
  { speed: 6, direction: 1 },
];

/**
 * Crop the logo down to the wordmark's ink bounding box, dropping the flat
 * margins around it. Without this the leftmost slice is mostly blank padding, so
 * the wordmark bunches into the right-hand columns instead of spreading evenly.
 */
function trimToContent(img: NativeImage): NativeImage {
  const { data, width, height, stride } = img.raw();
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const o = row + x * 4;
      const opaque = (data[o + 3] ?? 0) > 16;
      const lum = ((data[o] ?? 0) + (data[o + 1] ?? 0) + (data[o + 2] ?? 0)) / 3;
      if (opaque && lum < 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return img; // all flat — nothing to trim
  const pad = 2;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);
  return img.extract({ left, top, width: right - left + 1, height: bottom - top + 1 });
}

/**
 * Cut the logo into one vertical slice per column, widths proportional to each
 * column's rendered width, and hand each slice to its column to build the strip.
 * The proportional widths give every slice the same horizontal scale, so the
 * reassembled logo isn't distorted across columns.
 */
function assembleLogo(columns: CarouselColumn[], logo: NativeImage | null): void {
  const widths = columns.map((c) => c.width);
  const total = widths.reduce((a, b) => a + b, 0);
  if (!logo || total <= 0) {
    columns.forEach((c) => c.build(null, 0));
    return;
  }
  // Rows the wordmark should occupy so it keeps its aspect across the full span.
  // Terminal cells are ~twice as tall as wide, hence the /2. Shared by all cols.
  const aspect = logo.width / logo.height;
  const logoRows = Math.max(4, Math.min(CARD_H, Math.round(total / aspect / 2)));
  let leftPx = 0;
  columns.forEach((col, i) => {
    const last = i === columns.length - 1;
    const columnWidth = widths[i] ?? 0;
    const px = last ? logo.width - leftPx : Math.round((logo.width * columnWidth) / total);
    const slice = logo.extract({ left: leftPx, top: 0, width: px, height: logo.height });
    leftPx += px;
    col.build(slice, logoRows);
  });
}

export function run(renderer: CliRenderer, logo: NativeImage | null): void {
  renderer.start();
  renderer.setBackgroundColor(BACKGROUND);

  const root = new BoxRenderable(renderer, {
    id: "carousel-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 1,
    flexGrow: 1,
  });
  renderer.root.add(root);

  const split = new SplitPaneRenderable(renderer, {
    id: "carousel-split",
    direction: "horizontal",
    width: "100%",
    flexGrow: 1,
  });
  root.add(split);

  // Start every column the same width: split the usable row (minus padding and
  // the two gutters) into thirds. The last pane flexes, so it takes the rest.
  const avail = renderer.width - 2 - (COLUMNS.length - 1);
  const equalSize = Math.max(12, Math.floor(avail / COLUMNS.length));

  const columns: CarouselColumn[] = [];
  COLUMNS.forEach((spec, i) => {
    const col = new CarouselColumn(renderer, {
      id: `carousel-col-${i}`,
      speed: spec.speed,
      direction: spec.direction,
      height: "100%",
      flexGrow: 1,
    });
    columns.push(col);
    split.addPane(col, equalSize, 12);
  });

  const spinAll = () => columns.forEach((col, i) => col.jackpot(i, columns.length));

  let assembled = false;
  let openingSpin = false;
  let driftTimer = 0;
  renderer.setFrameCallback(async (deltaMs: number) => {
    const dt = deltaMs / 1000;
    // First frame with real geometry: cut the slices and build every strip.
    if (!assembled && columns.every((c) => c.height > 0 && c.width > 0)) {
      assembleLogo(columns, logo);
      assembled = columns.every((c) => c.isBuilt);
    }
    for (const col of columns) col.update(dt);
    // Let the reels drift in their 1/-1/1 directions for a beat, then fire one
    // opening jackpot so they converge on the logo hands-free.
    if (assembled && !openingSpin) {
      driftTimer += dt;
      if (driftTimer >= STARTUP_DRIFT) {
        openingSpin = true;
        spinAll();
      }
    }
    renderer.requestRender();
  });

  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.name === "space") {
      spinAll();
    } else if (key.name === "q") {
      destroy(renderer);
      process.exit(0);
    } else if (key.name === "`" || key.name === '"') {
      renderer.console.toggle();
    } else if (key.name === ".") {
      renderer.toggleDebugOverlay();
    }
  });
}

export function destroy(renderer: CliRenderer): void {
  renderer.clearFrameCallbacks();
  renderer.root.getRenderable("carousel-root")?.destroyRecursively();
}

if (import.meta.main) {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let logo: NativeImage | null = null;
  try {
    logo = trimToContent(await NativeImage.load(LOGO_PATH));
  } catch (err) {
    console.error(`could not load logo: ${String(err)}`);
  }
  run(renderer, logo);
}
