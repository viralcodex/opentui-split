# opentui-split

Draggable, resizable **split-pane** primitive for [OpenTUI](https://github.com/anomalyco/opentui).

Works three ways from one install:

- **Core** (`opentui-split`) — the engine: drag handling, gutter hit-testing,
  and size conservation.
- **React** (`opentui-split/react`) and **Solid** (`opentui-split/solid`) —
  thin adapters that register `<split-pane>` / `<split_pane>` intrinsics on
  import.

## Install

```bash
bun add opentui-split
# OR
npm i opentui-split
```

`@opentui/core` is a peer dependency; add `@opentui/react` or `@opentui/solid`
if you use those adapters. The package is ESM-only.

## Usage

Every pane but the last is fixed-size and draggable; the last flexes to fill
the remaining space, so the split always fills its container. Core users add
panes with `addPane(pane, size, minSize)`. React and Solid users render normal
box children and pass their sizes through `sizes` and `minSizes`.

`sizes`, `minSizes`, `direction`, `gutterSize`, and `gutterOptions` can be
updated after creation, including through reactive React and Solid props.
Sizes must be finite, non-negative numbers; `gutterSize` must be a positive
integer. Fractional minimum sizes round up to the next terminal cell while
dragging.

### Core

```typescript
import { SplitPaneRenderable } from "opentui-split";

const outer = new SplitPaneRenderable(renderer, {
  id: "outer",
  direction: "horizontal",
  onSizesChange: (sizes) => saveLayout(sizes),
});
outer.addPane(sidebar, /* size */ 26, /* minSize */ 16);
outer.addPane(mainArea, 80, 20);

const right = new SplitPaneRenderable(renderer, { id: "right", direction: "vertical" });
outer.addPane(right, 80, 20);
right.addPane(top, 14, 5);
right.addPane(bottom, 12, 4);
```

### React

Render normal OpenTUI elements as children. The split pane inserts and removes
gutters as React children mount, move, or unmount:

```tsx
/** @jsxImportSource @opentui/react */
import "opentui-split/react";

export function Layout() {
  return (
    <split-pane id="outer" direction="horizontal" sizes={[26, 80]} minSizes={[16, 20]}>
      <box id="sidebar" border title="Navigation" />
      <box id="main" border title="Content" />
    </split-pane>
  );
}
```

### Solid

Solid uses the same child and sizing model:

```tsx
/** @jsxImportSource @opentui/solid */
import "opentui-split/solid";

export function Layout() {
  return (
    <split_pane id="outer" direction="horizontal" sizes={[26, 80]} minSizes={[16, 20]}>
      <box id="sidebar" border title="Navigation" />
      <box id="main" border title="Content" />
    </split_pane>
  );
}
```

Use `gutterOptions` from Core, React, or Solid to configure every generated
gutter:

```tsx
<split-pane
  gutterOptions={{
    visible: true,
    color: "#78c8ff",
    glyphs: {
      horizontal: "┃",
      vertical: "━",
    },
  }}
>
  <box id="left" />
  <box id="right" />
</split-pane>
```

`glyphs.horizontal` is the divider used in a horizontal split;
`glyphs.vertical` is used in a vertical split. `setGutterVisible()` updates
existing gutters and the visibility of gutters created by later pane additions.
`onSizesChange` receives the rendered integer pane sizes after a drag or
container resize.

> The intrinsics self-register on import. If a bundler strips the side effect,
> call the exported `registerSplitPane()` once at startup — it's idempotent.

## Development

```bash
bun install
bun run format
bun run format:check
bun run typecheck
bun run test
bun run build
bun run test:dist
```

## Examples

```bash
bun examples/add-panes.ts
bun examples/slot-carousel.ts
```

`add-panes.ts` adds and removes panes at runtime. `slot-carousel.ts` combines
animated content with live gutter resizing.

## License

MIT
