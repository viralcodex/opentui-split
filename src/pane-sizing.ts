export function scaleSizes(sizes: number[], total: number): number[] {
  if (sizes.length === 0) return [];
  const sum = sizes.reduce((value, size) => value + size, 0);
  const exact = sizes.map((size) => (sum > 0 ? (size * total) / sum : total / sizes.length));
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
