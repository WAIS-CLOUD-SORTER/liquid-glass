#!/usr/bin/env node
/**
 * make-refraction-map.mjs — generate an SVG displacement map for feDisplacementMap.
 *
 * Channel semantics (matches references/material.md §4):
 *   R = horizontal shift, G = vertical shift, 0x80 = neutral.
 *   Two ramps are combined with mix-blend-mode: lighten (per-channel max),
 *   so neither channel clobbers the other.
 *
 * Zero dependencies; writes a file with --out, verifies one with --check,
 * or prints to stdout.
 *
 *   node assets/make-refraction-map.mjs --out assets/refraction-map.svg
 *   node assets/make-refraction-map.mjs --edge 0.14 --strength 0.63 --steps 6
 *   node assets/make-refraction-map.mjs --axis x --edge 0.08 --hard
 *   node assets/make-refraction-map.mjs --check assets/refraction-map.svg
 */

const argv = process.argv.slice(2);

function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) return true; // boolean flag
  return next;
}

const size = Number(opt("size", 100));
const edge = Number(opt("edge", 0.14));      // half-width of the lens band (0..0.5)
const strength = Number(opt("strength", 0.63)); // 0..1 — how far the borders deviate from neutral
const steps = Math.max(1, Number(opt("steps", 2)));
const axis = String(opt("axis", "both"));     // x | y | both
const hard = Boolean(opt("hard"));            // linear ramp instead of eased
const invert = Boolean(opt("invert"));        // flip the direction of the bend
const mid = Number(opt("mid", 0.5));          // neutral value (0..1), 0.5 = 128
const out = opt("out", null);
const check = opt("check", null);

if (!(edge > 0 && edge < 0.5)) {
  console.error(`--edge must be between 0 and 0.5 (got ${edge})`);
  process.exit(1);
}
if (!(strength >= 0 && strength <= 1)) {
  console.error(`--strength must be between 0 and 1 (got ${strength})`);
  process.exit(1);
}

const NEUTRAL = Math.round(mid * 255);
const delta = Math.round(strength * (invert ? -127 : 127));
const hex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

// Ease the ramp so the bend eases INTO the neutral band (Apple's look is a
// soft shoulder, not a crease). --hard gives a straight linear ramp instead.
function shoulder(t) {
  if (hard) return t;
  return 1 - Math.pow(1 - t, 2);
}

/** Stop offsets/colors for one ramp. dir = -1 (left/top) or +1 (right/bottom). */
function rampStops(dir) {
  const from = NEUTRAL + dir * delta;           // value at the very edge
  const start = dir < 0 ? 0 : 1;                // left/top edge vs right/bottom edge
  const stops = [[start, from]];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;                        // 0 → 1 travelling inward, toward the neutral band
    const offset = dir < 0 ? t * edge : 1 - t * edge;
    const value = NEUTRAL + dir * delta * (1 - shoulder(t));
    stops.push([offset, value]);
  }
  return stops.sort((a, b) => a[0] - b[0]);
}

function gradient(id, x1, y1, x2, y2, valueAtEdgeIsRed) {
  const stops = rampStops(1).concat(rampStops(-1)).sort((a, b) => a[0] - b[0]);
  // de-duplicate the neutral stops that meet in the middle
  const merged = stops.filter(([o], i, arr) => i === 0 || Math.abs(o - arr[i - 1][0]) > 1e-9);
  const body = merged
    .map(([offset, value]) => {
      const c = valueAtEdgeIsRed ? `#${hex(value)}0000` : `#00${hex(value)}00`;
      return `      <stop offset="${offset.toFixed(4)}" stop-color="${c}"/>`;
    })
    .join("\n");
  return `    <linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">\n${body}\n    </linearGradient>`;
}

const wantX = axis === "x" || axis === "both";
const wantY = axis === "y" || axis === "both";

// Neutral fill first so an axis-only map is still 0x80 where it has no ramp.
const layers = [];
if (wantY) {
  layers.push(`  <rect width="${size}" height="${size}" fill="url(#gy)"/>`);
}
if (wantX) {
  const blend = wantY ? ` style="mix-blend-mode: lighten"` : "";
  layers.push(`  <rect width="${size}" height="${size}" fill="url(#gx)"${blend}/>`);
}

const defs = [];
if (wantY) defs.push(gradient("gy", 0, 0, 0, 1, false));
if (wantX) defs.push(gradient("gx", 0, 0, 1, 0, true));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" preserveAspectRatio="none">
  <!--
    GENERATED FILE - do not edit by hand.
    Regenerate: node assets/make-refraction-map.mjs --out assets/refraction-map.svg
    Verify:     node assets/make-refraction-map.mjs --check assets/refraction-map.svg

    Displacement map for feDisplacementMap.
    R = horizontal shift, G = vertical shift, 0x80 (128) = neutral.
    Layer 1 carries G only (R,B = 0), layer 2 carries R only (G,B = 0); with
    mix-blend-mode: lighten the result is the per-channel max, so both survive.
    Neutral through the middle, ramping toward the borders = edge lensing.
    Steeper stops = harder lens.

    edge=${edge} strength=${strength} steps=${steps} axis=${axis} mid=${mid} ${hard ? "linear" : "eased"}${invert ? " inverted" : ""}
  -->
  <defs>
${defs.join("\n")}
  </defs>
${layers.join("\n")}
</svg>
`;

if (check) {
  const fs = await import("node:fs");
  if (!fs.existsSync(check)) {
    console.error(`check failed: ${check} does not exist`);
    process.exit(1);
  }
  const current = fs.readFileSync(check, "utf8");
  if (current === svg) {
    console.error(`ok: ${check} matches the generator output`);
  } else {
    console.error(
      `check failed: ${check} differs from the generator output.\n` +
        `  Regenerate with: node assets/make-refraction-map.mjs --out ${check}`
    );
    process.exit(1);
  }
} else if (out) {
  const fs = await import("node:fs");
  fs.writeFileSync(out, svg);
  console.error(`wrote ${out} (${svg.length} bytes) — edge=${edge} strength=${strength} axis=${axis}`);
} else {
  process.stdout.write(svg);
}
