# opentui-split

Resizable split panes for [OpenTUI](https://github.com/anomalyco/opentui), with
Core, React, and Solid exports.

## Install

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

Every pane except the last uses a fixed size. The last pane fills the remaining
space. Drag a gutter to resize its adjacent panes.

### Core

```typescript
import { SplitPaneRenderable } from "opentui-split";

const outer = new SplitPaneRenderable(renderer, {
  id: "outer",
  direction: "horizontal",
  onSizesChange: (sizes) => saveLayout(sizes),
});
outer.addPane(sidebar, 26, 16);
outer.addPane(mainArea, 80, 20);

const right = new SplitPaneRenderable(renderer, {
  id: "right",
  direction: "vertical",
});
outer.addPane(right, 80, 20);
right.addPane(top, 14, 5);
right.addPane(bottom, 12, 4);
```

`addPane` accepts the pane, initial size, and minimum size.

### React

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

The adapter imports register their components. If a bundler removes that side
effect, call `registerSplitPane()` once at startup.

## Split options

`SplitPaneOptions` accepts OpenTUI `BoxOptions` and these options:

| Option          | Type                         | Default        | Description                                                      |
| --------------- | ---------------------------- | -------------- | ---------------------------------------------------------------- |
| `direction`     | `"horizontal" \| "vertical"` | `"horizontal"` | Pane layout direction.                                           |
| `sizes`         | `number[]`                   | `20` / pane    | Initial sizes in cells. The last pane fills the remaining space. |
| `minSizes`      | `number[]`                   | `4` / pane     | Minimum sizes while dragging. Fractional values round up.        |
| `gutterSize`    | `number`                     | `1`            | Gutter width or height in cells.                                 |
| `gutterOptions` | `SplitPaneGutterOptions`     | See below      | Appearance shared by generated gutters.                          |
| `onSizesChange` | `(sizes: number[]) => void`  | None           | Called after a drag or container resize.                         |

`gutterOptions` accepts `visible`, `color`, and direction-specific `glyphs`. A
hidden gutter remains draggable too.

## Keyboard focus

`createPaneNavigator` moves focus through focusable renderables with `Tab` and
`Shift+Tab`. Set `focusedBorderColor` on panes to show focus state.

```typescript
import { createPaneNavigator } from "opentui-split";

const navigator = createPaneNavigator(renderer);
```

| Option          | Type                                                      | Default       | Description                               |
| --------------- | --------------------------------------------------------- | ------------- | ----------------------------------------- |
| `root`          | `BaseRenderable`                                          | Renderer root | Subtree to search.                        |
| `keymap`        | `(event) => "next" \| "previous" \| undefined` \| `false` | Tab keys      | Maps keys or disables automatic handling. |
| `wrap`          | `boolean`                                                 | `true`        | Wrap focus at either end.                 |
| `isPane`        | `(renderable) => boolean`                                 | Any focusable | Selects focusable panes.                  |
| `onFocusChange` | `(current, previous) => void`                             | None          | Runs after focus changes.                 |

Set `keymap` to `false` to use `focusNext()`, `focusPrevious()`, and
`focusPane()` manually. Call `dispose()` to unbind the keys.

## Pane movement

`createPaneMovement` handles mouse and keyboard movement. Dragging reorders panes
within one split or swaps panes across splits. `Option`/`Alt` + arrow is the
default keyboard shortcut.

```typescript
import { createPaneMovement } from "opentui-split";

const movement = createPaneMovement(renderer, {
  modifier: false,
  handle: (node) => node.id.endsWith("-title"),
  onReorder: (split, from, to) => saveLayout(split.sizes),
  onSwap: () => saveLayout(),
});
```

| Option      | Type                                                                     | Default       | Description                                     |
| ----------- | ------------------------------------------------------------------------ | ------------- | ----------------------------------------------- |
| `root`      | `Renderable`                                                             | Renderer root | Subtree whose panes can move.                   |
| `modifier`  | `"ctrl" \| "alt" \| "shift"` \| `false`                                  | `"ctrl"`      | Required drag key. `false` allows any drag.     |
| `handle`    | `(target, pane) => boolean`                                              | Whole pane    | Restricts where a drag can begin.               |
| `keymap`    | `(event) => "left" \| "right" \| "up" \| "down" \| undefined` \| `false` | Alt + arrow   | Maps keys or disables keyboard handling.        |
| `isPane`    | `(pane) => boolean`                                                      | Any pane      | Selects movable panes.                          |
| `onReorder` | `(split, from, to) => void`                                              | None          | Runs after an in-split move.                    |
| `onSwap`    | `(first, second) => void`                                                | None          | Runs after panes exchange places across splits. |

Some terminals do not report modifier keys during mouse drags. Set `modifier`
to `false` and use a `handle` there. Create one movement controller per root; it
owns `root.onMouse`. Specific mouse handlers such as `onMouseDown` still run.

Call `move(direction)` for manual keyboard movement and `dispose()` to unbind
mouse and keyboard handling. Core code can use `split.movePane(pane, toIndex)`
and read the order from `split.paneList`.

The default keymap also accepts macOS `Alt` + `b`/`f` word-motion escapes.
Use `createPaneDragDrop` or `createPaneReorder` when you only need one input
method. They accept the matching options from `createPaneMovement`.

## Examples

```bash
bun examples/add-panes.ts
```

It supports gutter resizing, `Tab` focus, pane creation/deletion,
drag reordering and `Option`/`Alt` + arrow keys for reordering.

## License

MIT
