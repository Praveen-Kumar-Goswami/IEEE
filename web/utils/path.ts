export type Point = readonly [number, number];

/** Catmull-Rom through the points as cubic Béziers. `tension` 0 is straight segments, 1 is full Catmull-Rom. */
export function smoothPath(points: Point[], tension = 0.7) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  const k = tension / 6;
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Closes a line path down to a baseline so it can be filled. */
export function areaPath(line: string, points: Point[], floor: number) {
  if (points.length === 0) return "";
  return `${line}L${points[points.length - 1][0]},${floor}L${points[0][0]},${floor}Z`;
}

export function sparkPath(values: (number | null)[], width: number, height: number, pad = 2) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pts: Point[] = [];
  values.forEach((v, i) => {
    if (v == null) return;
    pts.push([(i / (values.length - 1)) * width, pad + (1 - (v - min) / span) * (height - pad * 2)]);
  });
  return smoothPath(pts, 0.5);
}
