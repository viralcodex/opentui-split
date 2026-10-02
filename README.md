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

## Usage

Every pane but the last is fixed-size and draggable; the last flexes to fill
the remaining space, so the split always fills its container. Core users add
panes with `addPane(pane, size, minSize)`. React and Solid users render normal
box children and pass their sizes through `sizes` and `minSizes`.

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

> The intrinsics self-register on import. If a bundler strips the side effect,
> call the exported `registerSplitPane()` once at startup — it's idempotent.

## API

`SplitPaneOptions` includes all OpenTUI `BoxOptions` plus these options:

| Option          | Type                         | Default        | Description                                                                  |
| --------------- | ---------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `direction`     | `"horizontal" \| "vertical"` | `"horizontal"` | Pane layout direction.                                                       |
| `sizes`         | `number[]`                   | `20` per pane  | Initial pane sizes in terminal cells. The last pane flexes to fill the rest. |
| `minSizes`      | `number[]`                   | `4` per pane   | Minimum sizes used while dragging. Fractional values round up.               |
| `gutterSize`    | `number`                     | `1`            | Gutter width or height in cells. Must be a positive integer.                 |
| `gutterOptions` | `SplitPaneGutterOptions`     | See below      | Appearance and visibility shared by every generated gutter.                  |
| `onSizesChange` | `(sizes: number[]) => void`  | None           | Called with integer pane sizes after a drag or container resize.             |

#### `gutterOptions`

| Option    | Type             | Default                              | Description                                               |
| --------- | ---------------- | ------------------------------------ | --------------------------------------------------------- |
| `visible` | `boolean`        | `true`                               | Shows the hairline. A hidden gutter remains draggable.    |
| `color`   | `RGBA \| string` | `#78c8ff`                            | Any color accepted by OpenTUI.                            |
| `glyphs`  | `GutterGlyphs`   | `{ horizontal: "│", vertical: "─" }` | Optional divider strings selected by the split direction. |

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
