import * as THREE from "three";

/** Rounded rectangle extruded upward from y = 0, lying in the XZ plane. */
export function roundedPlate(width: number, depth: number, radius: number, thickness: number, bevel = 0.012) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  const r = Math.min(radius, width / 2, depth / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + depth - r);
  shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  shape.lineTo(x + r, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, thickness - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Orthogonal circuit route with softened corners, as a tube. */
export function traceTube(points: [number, number, number][], radius = 0.012) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    0.02,
  );
  return new THREE.TubeGeometry(curve, Math.max(24, points.length * 24), radius, 6, false);
}

/**
 * Bakes a curve into a 1D float texture so a shader can sample positions along it.
 * Nearest filtering: linear filtering of 32-bit float textures is an optional extension.
 */
export function curveTexture(curve: THREE.Curve<THREE.Vector3>, samples = 1024) {
  const data = new Float32Array(samples * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < samples; i++) {
    curve.getPointAt(i / (samples - 1), v);
    data.set([v.x, v.y, v.z, 1], i * 4);
  }
  const tex = new THREE.DataTexture(data, samples, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
