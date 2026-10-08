# opentui-split

Draggable, resizable **split-pane** primitive for [OpenTUI](https://github.com/anomalyco/opentui).

Works three ways from one install:

- **Core** (`opentui-split`): drag handling, gutter hit-testing,
  and size conservation.
- **React** (`opentui-split/react`) and **Solid** (`opentui-split/solid`) —
  thin adapters that register `<split_pane>` intrinsics on
  import.

## Install

Install the latest version directly from GitHub:

```bash
npm install github:viralcodex/opentui-split
```

```bash
pnpm add github:viralcodex/opentui-split
```

```bash
bun add github:viralcodex/opentui-split
```

## Usage

Every pane but the last is fixed-size and draggable; the last flexes to fill
the remaining space, so the split always fills its container.

Core users add panes with `addPane(pane, size, minSize)`.

React and Solid users render normal box children and pass their sizes through `sizes` and `minSizes`.

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

> The intrinsics self-register on import. If a bundler strips the side effect,
> call the exported `registerSplitPane()` once at startup — it's idempotent.

## Keyboard navigation

`createPaneNavigator` moves focus through focusable panes with `Tab` and `Shift+Tab`.
Set `focusedBorderColor` on each pane to show which one has focus.

```typescript
import { BoxRenderable } from "@opentui/core";
import { createPaneNavigator } from "opentui-split";

outer.addPane(new BoxRenderable(renderer, { focusable: true, focusedBorderColor: "#60a5fa" }));

const navigator = createPaneNavigator(renderer);
```

Use `keymap` to map any OpenTUI key event to `"next"` or `"previous"`:

```typescript
const navigator = createPaneNavigator(renderer, {
  keymap: (key) => (key.ctrl && key.name === "l" ? "next" : undefined),
});
```

Set `keymap` to `false` for manual control, then call `focusNext()` or `focusPrevious()`.

Call `dispose()` to unbind the keys.

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

### `createPaneNavigator(renderer, options?)`

Returns a `PaneNavigator` with `panes`, `current`, `focusNext()`,
`focusPrevious()`, `focusPane(target)`, and `dispose()`.

| Option          | Type                                                      | Default           | Description                                                 |
| --------------- | --------------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `root`          | `BaseRenderable`                                          | Renderer root     | Subtree to search for panes.                                |
| `keymap`        | `(event) => "next" \| "previous" \| undefined` \| `false` | `tab`/`shift+tab` | Maps key events to movement, or disables keyboard handling. |
| `wrap`          | `boolean`                                                 | `true`            | Cycle past the first and last pane.                         |
| `isPane`        | `(renderable) => boolean`                                 | Any focusable     | Which renderables count as panes.                           |
| `onFocusChange` | `(current, previous) => void`                             | None              | Called after focus moves between panes.                     |

## Development

```bash
bun install
bun run format
bun run lint
bun run check
bun run build
bun run test:dist
```

## Examples

```bash
bun examples/add-panes.ts
```

`add-panes.ts` adds and removes panes at runtime. Use `Tab` and `Shift+Tab` to move focus, `g`
to toggle gutters, and `h` to toggle buttons and gutters together.

## License

MIT
