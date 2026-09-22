/** JavaScript mirror of the CSS tokens in app/globals.css, for canvas, SVG and GSAP work. */

export const COLOR = {
  void: "#07080a",
  graphite950: "#0b0c0e",
  graphite900: "#111316",
  graphite850: "#16181c",
  graphite800: "#1c1f23",
  graphite700: "#2a2e34",
  graphite600: "#3a3f47",
  graphite500: "#4f555e",
  graphite400: "#6f757f",
  graphite300: "#959ba4",
  graphite200: "#c0c4ca",
  bone: "#edeae4",
  ivory: "#f5f2ec",
  signal: "#74d8c0",
  signalSoft: "#a9ead9",
  signalDeep: "#2a9c83",
  watch: "#e9b861",
  attention: "#f27a62",
  critical: "#f0545c",
  info: "#8ab4f8",
  offline: "#6f757f",
  copper: "#c98b5b",
} as const;

export const BREAKPOINT = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  "3xl": 1920,
} as const;

export const Z = {
  base: 0,
  raised: 10,
  sticky: 100,
  nav: 200,
  drawer: 300,
  modal: 400,
  toast: 500,
  command: 600,
  grain: 800,
  cursor: 900,
  loader: 1000,
} as const;
