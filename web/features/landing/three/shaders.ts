/* Small GLSL programs shared by the landing scenes. */

export const traceVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A pulse travels along the tube's length (uv.x). Base glow stays faint. */
export const traceFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOffset;
  uniform float uSpeed;
  uniform float uBase;
  uniform float uReach;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uReach) discard;
    float head = fract(uTime * uSpeed + uOffset);
    float d = vUv.x - head;
    float pulse = exp(-pow(d * 12.0, 2.0)) + exp(-pow((d + 1.0) * 12.0, 2.0));
    float a = uBase + pulse * 0.95;
    gl_FragColor = vec4(uColor * (1.0 + pulse * 2.4), a);
  }
`;

export const fresnelVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const fresnelFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), uPower);
    gl_FragColor = vec4(uColor * (1.0 + f), f * uIntensity);
  }
`;

/** Particles rise from their origin, drift, and fade at both ends of their life. */
export const riseVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uHeight;
  attribute vec3 aSeed;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vec3 p = position;
    float life = fract(aSeed.x + uTime * aSeed.y);
    p.y += life * uHeight;
    p.x += sin(uTime * 0.6 + aSeed.x * 12.0) * 0.28 * life;
    p.z += cos(uTime * 0.5 + aSeed.x * 9.0) * 0.28 * life;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSeed.z * uPixelRatio / -mv.z;
    vAlpha = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life));
    vTint = aSeed.z;
  }
`;

export const riseFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vTint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 c = mix(uColorA, uColorB, step(0.8, vTint));
    gl_FragColor = vec4(c, a * vAlpha * uOpacity);
  }
`;

/** Particles advance along a precomputed path (positions baked per point at t = 0..1). */
export const flowVertex = /* glsl */ `
  uniform float uTime;
  uniform float uReach;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aProgress;
  attribute float aSpeed;
  attribute vec3 aOffset;
  uniform sampler2D uPath;
  varying float vAlpha;
  void main() {
    float t = fract(aProgress + uTime * aSpeed) * uReach;
    vec3 p = texture2D(uPath, vec2(t, 0.5)).xyz + aOffset * (0.6 + 0.4 * sin(uTime + aProgress * 40.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio / -mv.z;
    vAlpha = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(uReach - 0.03, uReach, t));
  }
`;

export const flowFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(uColor * 1.6, a * vAlpha);
  }
`;
