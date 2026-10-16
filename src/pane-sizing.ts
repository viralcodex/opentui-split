import { BoxRenderable, type Renderable, Yoga } from "@opentui/core";

export function contentExtent(node: Renderable, horizontal: boolean): number {
  const layout = node.getComputedLayout();
  const edges = horizontal ? [Yoga.Edge.Left, Yoga.Edge.Right] : [Yoga.Edge.Top, Yoga.Edge.Bottom];
  const group = horizontal ? Yoga.Edge.Horizontal : Yoga.Edge.Vertical;
  const sides = horizontal ? (["left", "right"] as const) : (["top", "bottom"] as const);
  const border = node instanceof BoxRenderable ? node.border : false;
  const borderSize = sides.filter(
    (side) => border === true || (Array.isArray(border) && border.includes(side)),
  ).length;
  const paddings = edges.map((edge) =>
    [edge, group, Yoga.Edge.All]
      .map((candidate) => node.getPadding(candidate))
      .find((padding) => padding.unit !== Yoga.Unit.Undefined),
  );
  const hasPercent = paddings.some((padding) => padding?.unit === Yoga.Unit.Percent);
  const referenceWidth = hasPercent && node.parent ? contentExtent(node.parent, true) : 0;
  const paddingSize = paddings.reduce((total, padding) => {
    if (!padding) return total;
    const value =
      padding.unit === Yoga.Unit.Percent ? (padding.value * referenceWidth) / 100 : padding.value;
    return total + Math.max(0, value);
  }, 0);
  return Math.max(0, (horizontal ? layout.width : layout.height) - borderSize - paddingSize);
}

export function normalizeWeights(weights: number[]): number[] {
  const maximum = weights.reduce((value, weight) => Math.max(value, weight), 0);
  return weights.map((weight) => (maximum > 0 ? weight / maximum : 0));
}

export function scaleSizes(sizes: number[], total: number): number[] {
  if (sizes.length === 0) return [];
  const weights = normalizeWeights(sizes);
  const sum = weights.reduce((value, weight) => value + weight, 0);
  const exact = weights.map((weight) =>
    sum > 0 ? (weight / sum) * total : total / weights.length,
  );
  const scaled = exact.map(Math.floor);
  const remainder = total - scaled.reduce((value, size) => value + size, 0);
  const order = exact
    .map((size, index) => ({ index, fraction: size - scaled[index]! }))
    .sort((first, second) => second.fraction - first.fraction);
  for (let index = 0; index < remainder; index++) scaled[order[index]!.index]!++;
  return scaled;
}

export function fitSizes(sizes: number[], total: number): number[] {
  if (sizes.length === 0) return [];
  const fitted = sizes.map(Math.round);
  const fixedTotal = fitted.slice(0, -1).reduce((value, size) => value + size, 0);
  if (fixedTotal > total) return scaleSizes(fitted, total);
  fitted[fitted.length - 1] = total - fixedTotal;
  return fitted;
}
