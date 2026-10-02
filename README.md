# opentui-split

Draggable, resizable **split-pane** primitive for [OpenTUI](https://github.com/anomalyco/opentui).

```
BEHAVIOR: packaged.   STYLE: yours.
```

Ships in two halves, like shadcn/ui:

- **Engine** (`opentui-split`, this npm package) — owns the difficult behavior:
  drag handling, gutter hit-testing, and size conservation. Versioned; you get
  fixes.
- **Skin** (a copy-in *recipe*) — the editable presentation: gutter glyphs
  (`│` / `─`), hover color, and the "draw only on hover" decision. You copy
  it into your codebase with the shadcn CLI and own it outright.

The engine is a thin base; the skin is where you make it yours.

## Install

Add the engine package:

```bash
bun add opentui-split
# or: npm i opentui-split
```

Then copy the skin recipe for your framework into your project:

```bash
# core (imperative)
bunx shadcn@latest add <registry-url>/r/core/split-pane.json
# react
bunx shadcn@latest add <registry-url>/r/react/split-pane.json
# solid
bunx shadcn@latest add <registry-url>/r/solid/split-pane.json
```

The recipe lands in `components/ui/split-pane.ts` (or `.tsx`) and imports its
behavior from `opentui-split`. Edit that file freely — reinstalling with
`shadcn add` never clobbers it without asking, and `--diff` shows upstream
changes to merge.

## Usage (core / imperative)

```typescript
import { SplitPaneRenderable } from "./components/ui/split-pane.js"

const outer = new SplitPaneRenderable(renderer, { id: "outer", direction: "horizontal" })
outer.addPane(sidebar, /* size */ 26, /* minSize */ 16)
outer.addPane(mainArea, 80, 20)

const right = new SplitPaneRenderable(renderer, { id: "right", direction: "vertical" })
outer.addPane(right, 80, 20)
right.addPane(top, 14, 5)
right.addPane(bottom, 12, 4)
```

Every pane but the last is fixed-size and draggable; the last flexes to fill
the remaining space, so the split always fills its container.

## API

`SplitPaneRenderable extends BoxRenderable`

- `new SplitPaneRenderable(ctx, { direction?, sizes?, minSizes?, gutterSize?, onResize?, ...BoxOptions })`
- `.addPane(pane, size?, minSize?)` — register a pane; inserts a gutter before all but the first.

`GutterRenderable extends BoxRenderable` — the mouse-plumbing base. Draws nothing;
the skin subclass (`SplitGutterRenderable`) supplies rendering. Override
`SplitPaneRenderable.createGutter()` to swap in your own gutter.

## Development

```bash
bun install
bun run typecheck   # type-check engine, skins, and tests
bun test            # ports the original SplitPane behavior tests
bun run build       # emit dist/ (JS + d.ts) from src/
bun run test:dist   # smoke-test the built dist/ exports
bun examples/demo.ts   # interactive demo (needs a TTY)
```

`prepublishOnly` runs the full gate — `typecheck → test → build → test:dist` —
so a broken build can never be published. The engine ships compiled from
`dist/`; the skins ship as raw source under `registry/` for the shadcn CLI to
copy in.

## Demos

All need a TTY (run in a real terminal):

```bash
bun examples/demo.ts           # the base draggable/resizable split
bun examples/add-panes.ts      # grow the layout at runtime: ＋ splits a pane, ✕ deletes
bun examples/slot-carousel.ts  # logo-jackpot: three reels spin and land on the wordmark
```

`slot-carousel.ts` takes the add-panes layout — a row of equal-width columns, each
a stack of bordered "pane" boxes — and makes the boxes *move*. The logo
(`opentui.png`) is trimmed to its wordmark and cut into one vertical slice per
column, so the pieces reassemble left→right into the whole logo. Each column (a
`CarouselColumn`) drifts gently at rest; SPACE (or the opening auto-spin) fires a
jackpot — every column whooshes fast, then eases down and stops left→right so the
slices land on a shared payline and snap into one logo. The boxes are real
renderables clipped to their column (`overflow: "hidden"` + `translateY`), and the
columns live in `SplitPaneRenderable`, so dragging the gutters resizes them live.

## License

MIT
